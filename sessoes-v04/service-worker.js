const CACHE='dataprev-sessoes-clean-v041';
const CORE=[
  './','./index.html','./catalog-loader.js','./manifest.webmanifest',
  '../sessoes/index.html','../sessoes/sessions.json','../sessoes/PY-COND-R01.json','../sessoes/MAT-ALG-002.json','../sessoes/BD-NORM-002.json',
  '../sessoes/runtime-bridge.js','../sessoes/hotfix.js','../sessoes/session-ui-fix.js','../sessoes/session-start-v2.js','../sessoes/sync-completion-fix.js','../sessoes/adaptive-depth.js','../sessoes/adaptive-position-fix.js',
  '../icons/icon-192.png','../icons/icon-512.png','../icons/apple-touch-icon.png'
];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dataprev-sessoes-clean-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{const response=await fetch(request,{cache:'no-store'});if(response&&response.ok)await cache.put(request,response.clone());return response;}
  catch{return (await cache.match(request,{ignoreSearch:true}))||(await cache.match('./index.html'));}
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(networkFirst(event.request));
});