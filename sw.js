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
const CACHE = "libro-v4";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Si la red tarda más de esto (señal débil/inestable), se deja de esperar
// y se usa la copia en caché — para no quedarse pegado para siempre.
function fetchWithTimeout(request, options, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tiempo de espera agotado")), ms);
    fetch(request, options).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // sql.js (WASM) desde cdnjs: nunca cambia, cache-first. Si ya está en
  // caché no toca la red para nada (rápido). Si es la primera vez (o se
  // acaba de limpiar el caché del sitio) sí hay que esperar la descarga
  // —no hay forma de evitarlo, la app la necesita para funcionar— pero
  // con el mismo límite de tiempo: si la señal está mala y se cuelga, se
  // reintenta en vez de quedarse esperando para siempre.
  if (url.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetchWithTimeout(e.request, {}, 15000);
          cache.put(e.request, res.clone());
          return res;
        } catch (err) {
          return fetch(e.request); // último intento, sin límite de tiempo
        }
      })
    );
    return;
  }

  // Páginas HTML (navegación): red primero (para recibir actualizaciones),
  // pero con límite de tiempo — si no responde rápido, usa la copia en
  // caché en vez de dejar la pantalla pegada esperando.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetchWithTimeout(e.request, { cache: "reload" }, 4000)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || fetch(e.request)))
    );
    return;
  }

  // Otros archivos propios de la app (JS/CSS/íconos): mismo criterio.
  if (url.origin === location.origin) {
    e.respondWith(
      fetchWithTimeout(e.request, { cache: "reload" }, 4000)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || fetch(e.request)))
    );
  }
});
