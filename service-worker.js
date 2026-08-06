const CACHE_NAME = "dataprev-cards-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./hotfix.js",
  "./cards.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function injectHotfix(response) {
  const text = await response.text();
  const injected = text.includes("./hotfix.js")
    ? text
    : text.replace("</body>", '<script src="./hotfix.js?v=1.5.2"></script></body>');

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.delete("Content-Length");

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Requisições do Apps Script devem passar direto pelo navegador.
  if (url.origin !== self.location.origin) return;

  const isSessionsPath = url.pathname.includes("/sessoes/");
  const isRootNavigation = event.request.mode === "navigate" && !isSessionsPath;

  if (isRootNavigation) {
    event.respondWith((async () => {
      try {
        const network = await fetch(event.request, {cache: "no-store"});
        if (network.ok) {
          const copy = network.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return injectHotfix(network);
        }
      } catch {}

      const cached = await caches.match("./index.html");
      if (cached) return injectHotfix(cached);
      return new Response("DATAPREV Cards indisponível.", {status: 503});
    })());
    return;
  }

  const isCardsFile = url.pathname.endsWith("/cards.json");

  if (isCardsFile) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response || !response.ok) throw new Error("Resposta de rede inválida.");
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => {
            if (cached) return cached;
            throw new Error("cards.json indisponível na rede e no cache.");
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});