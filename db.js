/* ============================================
   db.js — SQLite real en el navegador vía sql.js,
   guardado cifrado (AES-256) dentro de IndexedDB.
   ============================================ */
const DB = (() => {
  let SQL = null;
  let sqlite = null; // instancia sql.js
  let dataKey = null; // CryptoKey AES compartida (de sesión)

  const BLOB_KEY = "contapp_db_blob"; // en IndexedDB

  async function loadEngine() {
    if (SQL) return SQL;
    SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
    });
    return SQL;
  }

  function schema() {
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL, -- 'ingreso' | 'gasto'
        color TEXT DEFAULT '#7CA982'
      );
      CREATE TABLE IF NOT EXISTS movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        tipo TEXT NOT NULL, -- 'ingreso' | 'gasto'
        monto REAL NOT NULL,
        categoria_id INTEGER,
        nota TEXT,
        usuario TEXT
      );
      CREATE TABLE IF NOT EXISTS presupuestos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_id INTEGER,
        limite REAL NOT NULL,
        periodo TEXT DEFAULT 'mensual'
      );
    `);
  }

  // Inicializa una base nueva y vacía (primer arranque)
  async function initEmpty(key) {
    await loadEngine();
    sqlite = new SQL.Database();
    schema();
    dataKey = key;
    await persist();
  }

  // Carga la base existente desde IndexedDB, descifrándola con dataKey
  async function load(key) {
    await loadEngine();
    dataKey = key;
    const blob = await IDB.get(BLOB_KEY);
    if (!blob) { sqlite = new SQL.Database(); schema(); return; }
    const { rows } = await Crypto.decryptJSON(blob, dataKey);
    const bytes = Uint8Array.from(atob(rows), c => c.charCodeAt(0));
    sqlite = new SQL.Database(bytes);
  }

  async function persist() {
    const bytes = sqlite.export();
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));
    const b64 = btoa(bin);
    const blob = await Crypto.encryptJSON({ rows: b64 }, dataKey);
    await IDB.set(BLOB_KEY, blob);
  }

  function run(sql, params = []) {
    sqlite.run(sql, params);
  }

  function all(sql, params = []) {
    const res = sqlite.exec(sql, params);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map(row => Object.fromEntries(row.map((v, i) => [columns[i], v])));
  }

  async function save() { await persist(); }

  return { initEmpty, load, run, all, save };
})();
