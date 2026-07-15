/* ============================================
   sheets.js — Sincronización con Google Sheets.
   Cada valor se sube YA CIFRADO (AES) con la misma
   dataKey del libro contable: el Sheet solo contiene
   texto ilegible.

   REQUIERE que el usuario configure, en Ajustes:
     - Client ID de OAuth (Google Cloud Console)
     - API Key
     - ID de la hoja de cálculo (Google Sheet)
   Ver README.md → "Configurar Google Sheets" para el paso a paso.
   ============================================ */
const Sheets = (() => {
  const CFG_KEY = "contapp_sheets_cfg"; // { clientId, apiKey, sheetId } — no es secreto sensible
  let tokenClient = null;
  let accessToken = null;

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
    catch { return {}; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.clientId && c.apiKey && c.sheetId);
  }

  // Carga las librerías de Google bajo demanda (evita peso si no se usa)
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureReady() {
    if (!window.gapi) await loadScript("https://apis.google.com/js/api.js");
    if (!window.google?.accounts) await loadScript("https://accounts.google.com/gsi/client");
    const { apiKey, clientId } = getConfig();
    await new Promise(res => gapi.load("client", res));
    await gapi.client.init({ apiKey, discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"] });
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      callback: () => {},
    });
  }

  function signIn() {
    return new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(resp);
        accessToken = resp.access_token;
        gapi.client.setToken({ access_token: accessToken });
        resolve(true);
      };
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  // Sube filas cifradas a una pestaña (una pestaña = una categoría de datos)
  async function pushEncryptedRows(tabName, rows, dataKey) {
    const { sheetId } = getConfig();
    const encryptedRows = await Promise.all(
      rows.map(async r => [await Crypto.encryptJSON(r, dataKey)])
    );
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      resource: { values: encryptedRows },
    });
  }

  async function pullEncryptedRows(tabName, dataKey) {
    const { sheetId } = getConfig();
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId, range: `${tabName}!A:A`,
    });
    const values = res.result.values || [];
    return Promise.all(values.map(([payload]) => Crypto.decryptJSON(payload, dataKey)));
  }

  return { getConfig, saveConfig, isConfigured, ensureReady, signIn, pushEncryptedRows, pullEncryptedRows };
})();
