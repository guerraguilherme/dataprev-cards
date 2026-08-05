const CACHE_NAME = "dataprev-cards-v4";
const APP_SHELL = [
  "./",
  "./index.html",
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

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Requisições do Apps Script devem passar direto pelo navegador.
  // Isso evita cachear URLs externas que contenham a chave de sincronização.
  if (url.origin !== self.location.origin) return;

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
