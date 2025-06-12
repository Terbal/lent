// service-worker.js
const CACHE_NAME = "lent-v1";
const ASSETS = [
  "./", // équivaut à /lent/
  "index.html",
  "style.css",
  "app.js",
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
