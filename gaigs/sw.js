const CACHE='gaigs-jarvis-v34';
const FILES=[
  './','./index.html','./styles.css?v=34','./vendor/ethers.umd.min.js',
  './app.js?v=34','./network-core.js?v=34','./platform-core.js?v=34',
  './social-logic.js','./social-core.js?v=23','./community-logic.js',
  './constitution-logic.js','./community-admin.js','./governance-logic.js',
  './access-logic.js','./governance-core.js','./operations-core.js',
  './humanity-lab-core.js','./jarvis-core.js','./map-core.js',
  './emergency-core.js','./notifications-core.js','./messaging-core.js',
  './marketplace-logic.js','./project-logic.js','./marketplace-core.js',
  './dashboard-core.js?v=23','./civic-core.js','./enterprise-news-core.js',
  './project-controls-core.js','./dao-core.js','./policy-core.js',
  './creator-library-data.js?v=24','./mission-library-core.js?v=32',
  './peer-mesh-v2.js?v=32','./video-feed-v2.js?v=32',
  './personal-jarvis-v2.js?v=32','./manifest.json','./icon-192.png',
  './icon-512.png','./icon-maskable.png'
];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response.ok)cache.put(request,response.clone());
    return response;
  }catch(error){
    return (await cache.match(request))||(await cache.match('./index.html'))||Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(request));return;}
  const navigation=request.mode==='navigate'||url.pathname.endsWith('/index.html');
  const changingAsset=/\.(?:js|css)$/.test(url.pathname);
  if(navigation||changingAsset){event.respondWith(networkFirst(request));return;}
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
