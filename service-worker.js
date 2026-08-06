const CACHE_NAME = "dataprev-cards-v9";
const CARDS_CACHE_PREFIX = "dataprev-cards-";
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
        keys
          .filter(key => key.startsWith(CARDS_CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function injectHotfix(response) {
  const text = await response.text();
  const injected = text.includes("./hotfix.js")
    ? text
    : text.replace("</body>", '<script src="./hotfix.js?v=1.5.3"></script></body>');

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

  // Requisições externas passam direto pelo navegador.
  if (url.origin !== self.location.origin) return;

  // O DATAPREV Sessões possui service worker e cache próprios.
  // Nenhuma rota cujo primeiro segmento comece por "sessoes" deve ser
  // interceptada, armazenada ou substituída pelo aplicativo de Cards.
  const relativePath = url.pathname.replace(self.registration.scope.replace(url.origin, ""), "");
  const firstSegment = relativePath.split("/").filter(Boolean)[0] || "";
  const isSessionsPath = firstSegment.startsWith("sessoes");
  if (isSessionsPath) return;

  const isRootNavigation = event.request.mode === "navigate";

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
      fetch(event.request, {cache: "no-store"})
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