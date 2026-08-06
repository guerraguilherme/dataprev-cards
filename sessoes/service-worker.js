const CACHE_NAME = "dataprev-sessoes-v4";
const OLD_CACHE_PREFIX = "dataprev-sessoes-";
const CORE = [
  "./sessions.json",
  "./manifest.webmanifest",
  "./hotfix.js?v=0.2.1",
  "../icons/icon-192.png",
  "../icons/icon-512.png",
  "../icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(OLD_CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function injectHotfix(response) {
  const text = await response.text();
  const injected = text.includes("./hotfix.js")
    ? text
    : text.replace(
        "</body>",
        '<script src="./hotfix.js?v=0.2.1"></script></body>'
      );

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.delete("Content-Length");

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (!response || !response.ok) throw new Error("Resposta de rede inválida.");

    await cache.put("./index.html", response.clone());
    return injectHotfix(response);
  } catch (error) {
    const cached = await cache.match("./index.html");
    if (cached) return injectHotfix(cached);

    return new Response("DATAPREV Sessões indisponível.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function dataNetworkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (!response || !response.ok) throw new Error("Resposta de rede inválida.");
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match(fallbackUrl));
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/sessoes/service-worker.js")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(event.request));
    return;
  }

  if (url.pathname.endsWith("/sessoes/sessions.json")) {
    event.respondWith(dataNetworkFirst(event.request, "./sessions.json"));
    return;
  }

  if (url.pathname.endsWith("/sessoes/hotfix.js")) {
    event.respondWith(dataNetworkFirst(event.request, "./hotfix.js?v=0.2.1"));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});