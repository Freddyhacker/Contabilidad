/* ============================================
   sheets.js — Sincronización con Google Sheets vía
   Google Apps Script (Web App), SIN pasar por Google
   Cloud Console. El script vive dentro del propio Sheet.

   Cada valor se sube YA CIFRADO (AES) con la dataKey del
   libro contable: el Sheet solo contiene texto ilegible.

   Configuración requerida en Ajustes:
     - URL del Web App (te la da Apps Script al publicarlo)
     - Clave secreta (la que tú definas en el script)
   Ver README.md → "Configurar Google Sheets" para el paso a paso.
   ============================================ */
const Sheets = (() => {
  const CFG_KEY = "contapp_sheets_cfg"; // { webAppUrl, secret }

  function getConfig() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(CFG_KEY)); } catch {}
    if (stored && stored.webAppUrl && stored.secret) return stored;
    if (typeof SHEETS_DEFAULT_CONFIG !== "undefined" && SHEETS_DEFAULT_CONFIG.webAppUrl && !SHEETS_DEFAULT_CONFIG.webAppUrl.startsWith("PEGA_AQUI")) {
      return SHEETS_DEFAULT_CONFIG;
    }
    return stored || {};
  }
  function saveConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }
  function isConfigured() {
    const c = getConfig();
    return !!(c.webAppUrl && c.secret);
  }

  async function call(body, opts = {}) {
    const { webAppUrl, secret } = getConfig();
    const payload = JSON.stringify({ ...body, secret });
    // Límite de tiempo real: si Sheets/la red no responde en 12s, se
    // aborta la petición en vez de dejarla colgada para siempre. Sin
    // esto, una mala racha de red podía ir acumulando conexiones
    // atoradas (el sondeo automático dispara peticiones nuevas cada
    // 15s/al volver a la pestaña, sin cancelar las anteriores).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let res;
    try {
      try {
        res = await fetch(webAppUrl, { method: "POST", body: payload, keepalive: !!opts.keepalive, signal: controller.signal });
      } catch (err) {
        // keepalive tiene un límite de ~64KB por petición; si el libro ya
        // creció mucho, se reintenta normal (ya no sobrevive a la
        // navegación, pero al menos no falla) — salvo que el error sea
        // por el propio timeout, ahí no tiene caso reintentar.
        if (opts.keepalive && err.name !== "AbortError") {
          res = await fetch(webAppUrl, { method: "POST", body: payload, signal: controller.signal });
        } else {
          throw err;
        }
      }
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // Sube filas cifradas a una pestaña (una pestaña = una categoría de datos)
  async function pushEncryptedRows(tabName, rows, dataKey) {
    const encryptedRows = await Promise.all(rows.map(r => Crypto.encryptJSON(r, dataKey)));
    await call({ action: "push", tab: tabName, rows: encryptedRows }, { keepalive: true });
  }

  async function pullEncryptedRows(tabName, dataKey) {
    const { rows } = await call({ action: "pull", tab: tabName });
    return Promise.all(rows.map(payload => Crypto.decryptJSON(payload, dataKey)));
  }

  return { getConfig, saveConfig, isConfigured, pushEncryptedRows, pullEncryptedRows };
})();
