// service-worker.js
const CACHE_NAME = "lent-v1";
const ASSETS = [
  "./", // page d’accueil
  "index.html",
  "app.js",
  "style.css",
  "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
