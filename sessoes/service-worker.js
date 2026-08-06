const CACHE_NAME = "dataprev-sessoes-v7";
const OLD_CACHE_PREFIX = "dataprev-sessoes-";
const CORE = [
  "./sessions.json",
  "./PY-COND-R01.json",
  "./MAT-ALG-002.json",
  "./BD-NORM-002.json",
  "./runtime-bridge.js?v=0.3",
  "./catalog-loader.js?v=0.3",
  "./hotfix.js?v=0.3",
  "./manifest.webmanifest",
  "../icons/icon-192.png",
  "../icons/icon-512.png",
  "../icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(OLD_CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function injectScripts(response) {
  const text = await response.text();
  const cleaned = text
    .replace(/<script src="\.\/runtime-bridge\.js[^"]*"><\/script>/g, "")
    .replace(/<script src="\.\/catalog-loader\.js[^"]*"><\/script>/g, "")
    .replace(/<script src="\.\/hotfix\.js[^"]*"><\/script>/g, "");
  const injected = cleaned.replace(
    "</body>",
    '<script src="./runtime-bridge.js?v=0.3"></script><script src="./catalog-loader.js?v=0.3"></script><script src="./hotfix.js?v=0.3"></script></body>'
  );
  const headers = new Headers(response.headers);
  headers.set("Content-Type","text/html; charset=utf-8");
  headers.delete("Content-Length");
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

async function networkFirst(request, fallback) {
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(!response||!response.ok)throw new Error("network");
    await cache.put(fallback||request,response.clone());
    return response;
  }catch{
    return (await cache.match(request)) || (fallback ? await cache.match(fallback) : null);
  }
}

self.addEventListener("fetch", event => {
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith("/sessoes/service-worker.js"))return;

  if(event.request.mode==="navigate"){
    event.respondWith((async()=>{
      const response=await networkFirst(event.request,"./index.html");
      if(response)return injectScripts(response);
      return new Response("DATAPREV Sessões indisponível.",{status:503});
    })());
    return;
  }

  if(
    url.pathname.endsWith("/sessoes/sessions.json") ||
    url.pathname.endsWith("/sessoes/PY-COND-R01.json") ||
    url.pathname.endsWith("/sessoes/MAT-ALG-002.json") ||
    url.pathname.endsWith("/sessoes/BD-NORM-002.json") ||
    url.pathname.endsWith("/sessoes/runtime-bridge.js") ||
    url.pathname.endsWith("/sessoes/catalog-loader.js") ||
    url.pathname.endsWith("/sessoes/hotfix.js")
  ){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});