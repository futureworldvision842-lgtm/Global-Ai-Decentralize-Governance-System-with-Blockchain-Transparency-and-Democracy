const CACHE='gaigs-v21-privacy-mobile';const FILES=['./','./index.html','./styles.css','./vendor/ethers.umd.min.js','./app.js','./platform-core.js','./social-logic.js','./social-core.js','./community-logic.js','./constitution-logic.js','./community-admin.js','./governance-logic.js','./access-logic.js','./governance-core.js','./operations-core.js','./humanity-lab-core.js','./jarvis-core.js','./map-core.js','./emergency-core.js','./notifications-core.js','./messaging-core.js','./marketplace-logic.js','./project-logic.js','./marketplace-core.js','./dashboard-core.js','./civic-core.js','./enterprise-news-core.js','./project-controls-core.js','./dao-core.js','./policy-core.js','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable.png'];
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='GET'&&u.origin===location.origin&&(u.pathname.endsWith('.js')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/styles.css'))){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
