const CACHE_NAME = "dicetower-cache-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
  // Als je icoontjes toevoegt, zet ze dan hieronder erbij:
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
      // Geef de gecachete versie terug, of haal hem van internet als hij er niet is
      return response || fetch(event.request);
    })
  );
});