const CACHE='gaigs-v22-workspace-refresh';const FILES=['./','./index.html','./styles.css?v=22','./vendor/ethers.umd.min.js','./app.js','./platform-core.js?v=22','./social-logic.js','./social-core.js?v=22','./community-logic.js','./constitution-logic.js','./community-admin.js','./governance-logic.js','./access-logic.js','./governance-core.js','./operations-core.js','./humanity-lab-core.js','./jarvis-core.js','./map-core.js','./emergency-core.js','./notifications-core.js','./messaging-core.js','./marketplace-logic.js','./project-logic.js','./marketplace-core.js','./dashboard-core.js?v=22','./civic-core.js','./enterprise-news-core.js','./project-controls-core.js','./dao-core.js','./policy-core.js','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='GET'&&u.origin===location.origin&&(u.pathname.endsWith('.js')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/styles.css'))){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
