/* Service Worker: nötig für die Installation als App und das Teilen-Ziel,
   und damit die App auch ohne Netz startet. Erst Netz, dann Cache. */
const CACHE="brain-v2";
/* Die Schriften gehören mit in den ersten Zugriff: sonst zeigt die App beim
   ersten Start ohne Netz die Ersatzschrift und springt später um. */
const DATEIEN=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png",
  "./fonts/inter-latin.woff2","./fonts/inter-latin-ext.woff2",
  "./fonts/instrumentserif-latin.woff2","./fonts/instrumentserif-latin-ext.woff2"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(DATEIEN)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys()
  .then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin) return;
  /* Schriften ändern sich nie: erst Cache, das spart bei jedem Start eine
     Anfrage. Und sie dürfen nie durch index.html ersetzt werden. */
  if(/\.woff2?$/.test(u.pathname)){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
      const kopie=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,kopie)); return res;
    })));
    return;
  }
  e.respondWith(fetch(e.request).then(res=>{
    const kopie=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,kopie)); return res;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});
