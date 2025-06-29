const CACHE_NAME = "lent-v1";
const ASSETS = ["./", "index.html", "app.js", "style.css", "manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // **Ignore** toutes les requêtes vers /socket.io/
  if (url.pathname.startsWith("/socket.io/")) {
    return; // on laisse passer la requête au réseau
  }

  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
