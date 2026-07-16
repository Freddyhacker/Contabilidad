/* ============================================
   sync.js — Sincronización automática con Sheets.
   - Verde: todo sincronizado
   - Amarillo: sincronizando ahora mismo
   - Rojo: no sincronizado (sin configurar, sin conexión,
     hay cambios pendientes, o falló el último intento)

   Si no hay conexión, los cambios quedan marcados como
   pendientes (localStorage) y se sincronizan solos en
   cuanto vuelve la conexión.
   ============================================ */
const Sync = (() => {
  const PENDING_KEY = "contapp_sync_pending";
  let ledEl = null;
  let dataKey = null;
  let syncing = false;

  function setLed(el, key) {
    ledEl = el;
    dataKey = key || dataKey;
    updateLed();
    // si hay cambios pendientes de antes y hay conexión, reintenta
    if (isPending() && navigator.onLine && Sheets.isConfigured()) doSync();
  }

  function isPending() {
    return localStorage.getItem(PENDING_KEY) === "1";
  }

  function updateLed() {
    if (!ledEl || !ledEl.length) return;
    let color, title;
    if (syncing) { color = "var(--accent-expense)"; title = "Sincronizando..."; }
    else if (!Sheets.isConfigured()) { color = "var(--accent-danger)"; title = "Sincronización no configurada"; }
    else if (!navigator.onLine) { color = "var(--accent-danger)"; title = "Sin conexión — se sincronizará al reconectar"; }
    else if (isPending()) { color = "var(--accent-danger)"; title = "Cambios sin sincronizar"; }
    else { color = "var(--accent-income)"; title = "Sincronizado"; }
    ledEl.forEach(el => { el.style.background = color; el.title = title; });
  }

  // Se llama cada vez que se guarda un cambio en la base local. Arranca el
  // envío YA MISMO (sin esperar un debounce): la petición usa keepalive,
  // así que sobrevive aunque cambies de página justo después — pero eso
  // solo protege una petición YA EN CURSO, no una programada para más
  // tarde con setTimeout.
  function markDirty(key) {
    if (key) dataKey = key;
    localStorage.setItem(PENDING_KEY, "1");
    updateLed();
    if (Sheets.isConfigured() && navigator.onLine) doSync();
  }

  async function doSync() {
    if (!dataKey || !Sheets.isConfigured() || !navigator.onLine || syncing) return;
    syncing = true;
    updateLed();
    try {
      const movimientos = DB.all("SELECT * FROM movimientos");
      const categorias = DB.all("SELECT * FROM categorias");
      const presupuestos = DB.all("SELECT * FROM presupuestos");
      // Las 3 pestañas se suben en paralelo (antes era una por una, que
      // triplicaba el tiempo de espera por la latencia de Apps Script)
      await Promise.all([
        Sheets.pushEncryptedRows("movimientos", movimientos, dataKey),
        Sheets.pushEncryptedRows("categorias", categorias, dataKey),
        Sheets.pushEncryptedRows("presupuestos", presupuestos, dataKey),
      ]);
      localStorage.removeItem(PENDING_KEY);
    } catch (err) {
      // se queda "pendiente"; se reintentará en el próximo cambio o reconexión
    }
    syncing = false;
    updateLed();
  }

  window.addEventListener("online", () => {
    updateLed();
    if (isPending()) doSync();
  });
  window.addEventListener("offline", updateLed);

  // Trae todo el libro (categorías, movimientos, presupuestos) desde Sheets.
  // Se usa cuando un dispositivo nuevo inicia sesión y su base local está vacía.
  async function pullAll(key) {
    if (!Sheets.isConfigured()) return false;
    try {
      const [categorias, movimientos, presupuestos] = await Promise.all([
        Sheets.pullEncryptedRows("categorias", key),
        Sheets.pullEncryptedRows("movimientos", key),
        Sheets.pullEncryptedRows("presupuestos", key),
      ]);
      DB.importRemote("categorias", categorias);
      DB.importRemote("movimientos", movimientos);
      DB.importRemote("presupuestos", presupuestos);
      await DB.save();
      return true;
    } catch (err) {
      return false;
    }
  }

  // ---------- Revisión de cambios remotos ----------
  // Se llama UNA VEZ por carga de página (no en un timer), en segundo
  // plano: la pantalla ya se muestra con los datos locales (rápido) y
  // esto solo actualiza si de verdad hay algo distinto en el Sheet
  // (por ejemplo, un movimiento agregado desde otro dispositivo).
  let checking = false;

  function canonical(rows) {
    return JSON.stringify(
      [...rows].map(r => ({ ...r, id: Number(r.id) })).sort((a, b) => a.id - b.id)
    );
  }

  async function checkRemoteChanges() {
    if (checking || syncing) return;
    if (!dataKey || !Sheets.isConfigured() || !navigator.onLine) return;
    // si hay cambios locales sin subir, primero se suben para no perderlos
    if (isPending()) await doSync();

    checking = true;
    try {
      const [remoteCategorias, remoteMovimientos, remotePresupuestos] = await Promise.all([
        Sheets.pullEncryptedRows("categorias", dataKey),
        Sheets.pullEncryptedRows("movimientos", dataKey),
        Sheets.pullEncryptedRows("presupuestos", dataKey),
      ]);
      const remoteChanged =
        canonical(remoteCategorias) !== canonical(DB.all("SELECT * FROM categorias")) ||
        canonical(remoteMovimientos) !== canonical(DB.all("SELECT * FROM movimientos")) ||
        canonical(remotePresupuestos) !== canonical(DB.all("SELECT * FROM presupuestos"));

      if (remoteChanged) {
        DB.replaceAll("categorias", remoteCategorias);
        DB.replaceAll("movimientos", remoteMovimientos);
        DB.replaceAll("presupuestos", remotePresupuestos);
        await DB.save({ silent: true }); // no volver a subir lo que se acaba de bajar
        window.dispatchEvent(new CustomEvent("libro:synced"));
      }
    } catch (err) {
      // no pasa nada: se reintenta en la próxima carga de página
    }
    checking = false;
  }

  return { setLed, markDirty, updateLed, doSync, pullAll, checkRemoteChanges };
})();
