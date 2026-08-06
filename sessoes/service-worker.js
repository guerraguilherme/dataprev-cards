const CACHE_NAME='dataprev-sessoes-v2';
const CORE=['./','./index.html','./hotfix.js','./sessions.json','./manifest.webmanifest','../icons/icon-192.png','../icons/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function injectHotfix(response){
  const text=await response.text();
  const injected=text.includes('./hotfix.js')
    ?text
    :text.replace('</body>','<script src="./hotfix.js?v=0.2"></script></body>');
  const headers=new Headers(response.headers);
  headers.set('Content-Type','text/html; charset=utf-8');
  headers.delete('Content-Length');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  if(event.request.method!=='GET')return;

  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const network=await fetch(event.request,{cache:'no-store'});
        if(network.ok){
          const copy=network.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));
          return injectHotfix(network);
        }
      }catch{}
      const cached=await caches.match('./index.html');
      if(cached)return injectHotfix(cached);
      return new Response('DATAPREV Sessões indisponível.',{status:503});
    })());
    return;
  }

  if(url.pathname.endsWith('/sessions.json')){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
    return response;
  })));
});