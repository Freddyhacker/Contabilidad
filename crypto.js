/* ============================================
   crypto.js — Cifrado real usando Web Crypto API
   - PBKDF2: deriva una llave AES a partir de la contraseña
   - AES-256-GCM: cifra/descifra los datos
   - SHA-256: hash de verificación de contraseña
   ============================================ */
const Crypto = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function buf2b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function b642buf(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }

  // Hash de verificación de contraseña (SHA-256 + salt), NO es la llave de cifrado
  async function hashPassword(password, saltB64) {
    const salt = saltB64 ? b642buf(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const data = enc.encode(salt.join(",") + password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return { hash: buf2b64(digest), salt: buf2b64(salt) };
  }

  async function verifyPassword(password, saltB64, expectedHashB64) {
    const { hash } = await hashPassword(password, saltB64);
    return hash === expectedHashB64;
  }

  // Deriva una llave AES-256 a partir de la contraseña (PBKDF2, 150k iteraciones)
  async function deriveKey(password, saltB64) {
    const salt = b642buf(saltB64);
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptJSON(obj, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = enc.encode(JSON.stringify(obj));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    return `${buf2b64(iv)}.${buf2b64(cipher)}`;
  }

  async function decryptJSON(payload, key) {
    const [ivB64, cipherB64] = payload.split(".");
    const iv = b642buf(ivB64);
    const cipher = b642buf(cipherB64);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return JSON.parse(dec.decode(plain));
  }

  // Llave aleatoria de datos, envuelta (cifrada) con una llave derivada de contraseña.
  // Permite que el admin también pueda "desenvolver" la llave de datos con SU propia
  // contraseña, sin conocer la del usuario -> reset de contraseña sin perder datos.
  async function generateDataKey() {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const raw = await crypto.subtle.exportKey("raw", key);
    return { key, rawB64: buf2b64(raw) };
  }
  async function importRawKey(rawB64) {
    return crypto.subtle.importKey("raw", b642buf(rawB64), "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  async function wrapDataKey(dataKeyRawB64, wrappingKey) {
    return encryptJSON({ k: dataKeyRawB64 }, wrappingKey);
  }
  async function unwrapDataKey(payload, wrappingKey) {
    const { k } = await decryptJSON(payload, wrappingKey);
    return importRawKey(k);
  }

  function randomSalt() {
    return buf2b64(crypto.getRandomValues(new Uint8Array(16)));
  }

  return {
    hashPassword, verifyPassword, deriveKey,
    encryptJSON, decryptJSON,
    generateDataKey, importRawKey, wrapDataKey, unwrapDataKey,
    randomSalt
  };
})();
