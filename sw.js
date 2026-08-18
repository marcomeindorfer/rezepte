/* Service Worker: nötig, damit Android die App als Teilen-Ziel akzeptiert,
   und praktisch, damit sie im Supermarkt ohne Empfang startet.
   Strategie: erst Netz, bei Misserfolg Cache. So sind Updates sofort da. */
const CACHE = "kuechenplan-v1";
const DATEIEN = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   /* Firebase nie abfangen */
  e.respondWith(
    fetch(e.request)
      .then(res => {
        /* Nur geglückte Antworten in den Zwischenspeicher. Sonst liegt dort
           irgendwann eine Fehlerseite und wird im Supermarkt ausgeliefert. */
        if (res && res.ok && res.type === "basic") {
          const kopie = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, kopie)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
