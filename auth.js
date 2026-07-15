/* ============================================
   auth.js — Usuarios, contraseñas y sesión.
   Los usuarios comparten una misma "llave de datos"
   (dataKey) que cifra el libro contable. Cada usuario
   guarda una copia de esa llave envuelta con SU propia
   contraseña -> el admin puede re-envolverla con una
   contraseña nueva si alguien la olvida, sin perder datos.
   ============================================ */
const Auth = (() => {
  const USERS_KEY = "contapp_users";       // en IndexedDB
  const REMEMBER_KEY = "contapp_remember"; // en localStorage (por dispositivo)
  const SESSION_KEY = "contapp_session";   // en sessionStorage

  async function getUsers() {
    return (await IDB.get(USERS_KEY)) || [];
  }
  async function saveUsers(users) {
    await IDB.set(USERS_KEY, users);
  }

  async function hasAnyUser() {
    return (await getUsers()).length > 0;
  }

  // Primer usuario = admin, crea la base de datos y la llave de datos compartida
  async function registerFirstAdmin(username, password) {
    const salt = Crypto.randomSalt();
    const { hash } = await Crypto.hashPassword(password, salt);
    const wrapKey = await Crypto.deriveKey(password, salt);
    const { key: dataKey, rawB64 } = await Crypto.generateDataKey();
    const wrappedDataKey = await Crypto.wrapDataKey(rawB64, wrapKey);

    const user = { username, role: "admin", salt, passwordHash: hash, wrappedDataKey };
    await saveUsers([user]);
    await DB.initEmpty(dataKey);
    await storeSessionKey(username, "admin", dataKey);
    return dataKey;
  }

  // Admin agrega un nuevo usuario, reutilizando la misma llave de datos
  async function addUser(username, password, role, adminDataKey) {
    const users = await getUsers();
    if (users.some(u => u.username === username)) throw new Error("Ese usuario ya existe");
    const salt = Crypto.randomSalt();
    const { hash } = await Crypto.hashPassword(password, salt);
    const wrapKey = await Crypto.deriveKey(password, salt);
    const raw = await crypto.subtle.exportKey("raw", adminDataKey);
    const rawB64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    const wrappedDataKey = await Crypto.wrapDataKey(rawB64, wrapKey);
    users.push({ username, role, salt, passwordHash: hash, wrappedDataKey });
    await saveUsers(users);
  }

  async function login(username, password) {
    const users = await getUsers();
    const user = users.find(u => u.username === username);
    if (!user) throw new Error("Usuario no encontrado");
    const ok = await Crypto.verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) throw new Error("Contraseña incorrecta");
    const wrapKey = await Crypto.deriveKey(password, user.salt);
    const dataKey = await Crypto.unwrapDataKey(user.wrappedDataKey, wrapKey);
    await DB.load(dataKey);
    await storeSessionKey(user.username, user.role, dataKey);
    return { user, dataKey };
  }

  // Guarda la llave de datos SOLO en sessionStorage (se borra al cerrar la
  // pestaña) para poder navegar entre páginas sin volver a pedir contraseña
  // en cada una. No se guarda en disco salvo que actives "Recuérdame".
  async function storeSessionKey(username, role, dataKey) {
    const raw = await crypto.subtle.exportKey("raw", dataKey);
    const rawB64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username, role, k: rawB64 }));
  }

  // Se llama al cargar cada página protegida: recupera sesión + reabre la DB
  async function restoreSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const { username, role, k } = JSON.parse(raw);
      const dataKey = await Crypto.importRawKey(k);
      await DB.load(dataKey);
      return { username, role, dataKey };
    }
    return tryAutoLogin();
  }

  // Admin restablece la contraseña de otro usuario sin perder acceso a los datos
  async function adminResetPassword(adminDataKey, targetUsername, newPassword) {
    const users = await getUsers();
    const target = users.find(u => u.username === targetUsername);
    if (!target) throw new Error("Usuario no encontrado");
    const salt = Crypto.randomSalt();
    const { hash } = await Crypto.hashPassword(newPassword, salt);
    const wrapKey = await Crypto.deriveKey(newPassword, salt);
    const raw = await crypto.subtle.exportKey("raw", adminDataKey);
    const rawB64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    target.salt = salt;
    target.passwordHash = hash;
    target.wrappedDataKey = await Crypto.wrapDataKey(rawB64, wrapKey);
    await saveUsers(users);
  }

  // "Recuérdame": guarda la llave de datos ya desenvuelta, cifrada con una
  // llave fija de este dispositivo (localStorage). Solo sirve en este navegador.
  async function rememberDevice(username, dataKey) {
    const deviceKeyRaw = await getOrCreateDeviceKey();
    const raw = await crypto.subtle.exportKey("raw", dataKey);
    const rawB64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    const deviceKey = await Crypto.importRawKey(deviceKeyRaw);
    const payload = await Crypto.encryptJSON({ k: rawB64 }, deviceKey);
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, payload }));
  }

  async function getOrCreateDeviceKey() {
    let k = localStorage.getItem("contapp_device_key");
    if (!k) {
      const { rawB64 } = await Crypto.generateDataKey();
      k = rawB64;
      localStorage.setItem("contapp_device_key", k);
    }
    return k;
  }

  async function tryAutoLogin() {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (!stored) return null;
    const { username, payload } = JSON.parse(stored);
    const deviceKeyRaw = await getOrCreateDeviceKey();
    const deviceKey = await Crypto.importRawKey(deviceKeyRaw);
    const { k } = await Crypto.decryptJSON(payload, deviceKey);
    const dataKey = await Crypto.importRawKey(k);
    await DB.load(dataKey);
    const users = await getUsers();
    const user = users.find(u => u.username === username);
    const role = user?.role || "usuario";
    await storeSessionKey(username, role, dataKey);
    return { username, role, dataKey };
  }

  function forgetDevice() {
    localStorage.removeItem(REMEMBER_KEY);
  }

  function currentSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  return {
    hasAnyUser, registerFirstAdmin, addUser, login,
    adminResetPassword, rememberDevice, tryAutoLogin, forgetDevice,
    currentSession, logout, getUsers, restoreSession, storeSessionKey
  };
})();
