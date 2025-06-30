// ——————————————————————————————————
// Versionnée pour forcer le refresh
// ——————————————————————————————————
const CACHE_NAME = "lent-v2";
const ASSETS = [
  "./",
  "index.html",
  "app.js",
  "style.css",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  // Active tout de suite la nouvelle version
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  // Prend le contrôle immédiatement
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Toujours passer au réseau pour les navigations (index.html)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // on met en cache la nouvelle version en passant
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Ignorer socket.io
  if (url.pathname.startsWith("/socket.io/")) {
    return;
  }

  // Pour tout le reste : cache-first
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
