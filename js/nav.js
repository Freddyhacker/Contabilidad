/* ============================================
   nav.js — Rellena lo dinámico del sidebar (usuario, LED, listeners)
   + protección de páginas. El HTML del menú ya viene fijo en cada
   página (no se genera con JS) para que no haya parpadeo al cargar.
   ============================================ */

function renderSidebar(session) {
  const initials = (session?.username || "?").slice(0, 2).toUpperCase();
  document.getElementById("user-avatar").textContent = initials;
  document.getElementById("user-name").textContent = session?.username || "";
  document.getElementById("user-role").textContent = session?.role === "admin" ? "Administrador" : "Usuario";

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    Auth.logout();
    Auth.forgetDevice();
    location.href = "index.html";
  });

  const sidebarInner = document.getElementById("sidebar-inner");
  const backdrop = document.getElementById("sidebar-backdrop");
  const openMenu = () => { sidebarInner.classList.add("open"); backdrop.classList.add("open"); };
  const closeMenu = () => { sidebarInner.classList.remove("open"); backdrop.classList.remove("open"); };
  document.getElementById("menu-toggle").addEventListener("click", openMenu);
  backdrop.addEventListener("click", closeMenu);
  sidebarInner.querySelectorAll(".nav-list a").forEach(a => a.addEventListener("click", closeMenu));
}

// Toda página protegida llama a esto al cargar
async function guardPage() {
  const session = await Auth.restoreSession();
  if (!session) { location.href = "index.html"; return null; }
  renderSidebar(session);
  if (typeof Sync !== "undefined") Sync.setLed(document.querySelectorAll(".sync-led"), session.dataKey);

  // Apariencia: se aplica de inmediato con lo que ya hay guardado en este
  // dispositivo (rápido, sin esperar red).
  if (typeof Auth !== "undefined" && typeof Theme !== "undefined") {
    const theme = await Auth.getUserTheme(session.username);
    if (theme && Object.keys(theme).length) Theme.apply(theme);
  }

  // Revisión de cambios remotos: en SEGUNDO PLANO, sin esperar (no bloquea
  // la pantalla). Si hay algo nuevo de otro dispositivo, se aplica solo.
  if (typeof Sync !== "undefined") Sync.checkRemoteChanges();

  return session;
}
