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
  let debounceTimer = null;
  let syncing = false;

  function setLed(el, key) {
    ledEl = el;
    dataKey = key || dataKey;
    updateLed();
    // si hay cambios pendientes de antes y hay conexión, reintenta
    if (isPending() && navigator.onLine && Sheets.isConfigured()) scheduleSync(200);
  }

  function isPending() {
    return localStorage.getItem(PENDING_KEY) === "1";
  }

  function updateLed() {
    if (!ledEl) return;
    let color, title;
    if (syncing) { color = "var(--accent-expense)"; title = "Sincronizando..."; }
    else if (!Sheets.isConfigured()) { color = "var(--accent-danger)"; title = "Sincronización no configurada"; }
    else if (!navigator.onLine) { color = "var(--accent-danger)"; title = "Sin conexión — se sincronizará al reconectar"; }
    else if (isPending()) { color = "var(--accent-danger)"; title = "Cambios sin sincronizar"; }
    else { color = "var(--accent-income)"; title = "Sincronizado"; }
    ledEl.style.background = color;
    ledEl.title = title;
  }

  // Se llama cada vez que se guarda un cambio en la base local
  function markDirty(key) {
    if (key) dataKey = key;
    localStorage.setItem(PENDING_KEY, "1");
    updateLed();
    if (Sheets.isConfigured() && navigator.onLine) scheduleSync(800);
  }

  function scheduleSync(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSync, delay);
  }

  async function doSync() {
    if (!dataKey || !Sheets.isConfigured() || !navigator.onLine || syncing) return;
    syncing = true;
    updateLed();
    try {
      const movimientos = DB.all("SELECT * FROM movimientos");
      const categorias = DB.all("SELECT * FROM categorias");
      const presupuestos = DB.all("SELECT * FROM presupuestos");
      await Sheets.pushEncryptedRows("movimientos", movimientos, dataKey);
      await Sheets.pushEncryptedRows("categorias", categorias, dataKey);
      await Sheets.pushEncryptedRows("presupuestos", presupuestos, dataKey);
      localStorage.removeItem(PENDING_KEY);
    } catch (err) {
      // se queda "pendiente"; se reintentará en el próximo cambio o reconexión
    }
    syncing = false;
    updateLed();
  }

  window.addEventListener("online", () => {
    updateLed();
    if (isPending()) scheduleSync(300);
  });
  window.addEventListener("offline", updateLed);

  return { setLed, markDirty, updateLed, doSync };
})();
