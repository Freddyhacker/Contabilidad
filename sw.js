/* ============================================
   sw.js — Cachea el motor de sql.js (pesado, no cambia)
   y los archivos propios de la app, para que después de
   la primera visita todo cargue casi instantáneo.
   También es lo que hace falta para que Chrome ofrezca
   "Instalar app" de verdad (no solo un acceso directo que
   abre pestaña nueva).

   Las PÁGINAS (HTML) nunca se sirven desde caché si hay
   internet — solo como último recurso sin conexión. Así se
   evita que quede atorada una versión vieja de una página
   (con scripts desactualizados) si alguna vez una descarga
   falló a medias.
   ============================================ */
const CACHE = "libro-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // sql.js (WASM) desde cdnjs: nunca cambia, cache-first
  if (url.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        cache.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // Páginas HTML (navegación): SIEMPRE red si hay internet. Solo se usa
  // la copia en caché cuando de verdad no hay conexión.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Otros archivos propios de la app (JS/CSS/íconos): red primero (para
  // recibir actualizaciones), con la copia en caché como respaldo
  // instantáneo / modo sin conexión
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
