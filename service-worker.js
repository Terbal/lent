// service-worker.js
const CACHE_NAME = "lent-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(["/", "/index.html", "/app.js", "/style.css"])
      )
  );
});
