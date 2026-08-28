const CACHE_NAME = "dicetower-cache-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
  // Vergeet niet hier later je iconen toe te voegen als je die hebt!
  // "./icon-192.png",
  // "./icon-512.png"
];

// Installeer de bestanden in het geheugen
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Bestanden gecached voor offline gebruik!");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Laad de pagina uit het geheugen als er geen internet is
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});