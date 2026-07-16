/* ============================================
   nav.js — Sidebar compartido + protección de páginas
   ============================================ */
const NAV_ITEMS = [
  { href: "dashboard.html", label: "Dashboard", ico: "◆" },
  { href: "transacciones.html", label: "Ingresos y gastos", ico: "≡" },
  { href: "presupuestos.html", label: "Presupuestos", ico: "◧" },
  { href: "reportes.html", label: "Reportes", ico: "▤" },
  { href: "categorias.html", label: "Categorías", ico: "●" },
  { href: "ajustes.html", label: "Ajustes", ico: "⚙" },
];

function renderSidebar(activeHref, session) {
  const current = location.pathname.split("/").pop();
  const items = NAV_ITEMS.map(it => `
    <li><a href="${it.href}" class="${current === it.href ? 'active' : ''}">
      <span class="ico">${it.ico}</span>${it.label}
    </a></li>`).join("");

  const initials = (session?.username || "?").slice(0, 2).toUpperCase();

  const markHtml = `<span class="ledger-mark"></span>Libro`;

  document.getElementById("sidebar-mount").innerHTML = `
    <div class="mobile-topbar">
      <button class="brand brand-toggle" id="menu-toggle" aria-label="Abrir menú">${markHtml}</button>
      <span class="sync-led" style="width:9px;height:9px;border-radius:50%;background:var(--accent-danger)"></span>
    </div>
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <div class="sidebar-inner" id="sidebar-inner">
      <div class="brand">${markHtml}<span class="sync-led" style="width:9px;height:9px;border-radius:50%;background:var(--accent-danger);margin-left:2px"></span></div>
      <ul class="nav-list">${items}</ul>
      <div class="sidebar-footer">
        <div class="user-row">
          <div class="avatar">${initials}</div>
          <div>
            <div style="color:var(--text-primary)">${session?.username || ""}</div>
            <span class="badge">${session?.role === "admin" ? "Administrador" : "Usuario"}</span>
          </div>
        </div>
        <a href="#" id="logout-link">Cerrar sesión</a>
      </div>
    </div>`;

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
  renderSidebar(location.pathname.split("/").pop(), session);
  if (typeof Sync !== "undefined") Sync.setLed(document.querySelectorAll(".sync-led"), session.dataKey);

  // Apariencia: se aplica de inmediato con lo que ya hay guardado en este
  // dispositivo (rápido, sin esperar red).
  if (typeof Auth !== "undefined" && typeof Theme !== "undefined") {
    const theme = await Auth.getUserTheme(session.username);
    if (theme && Object.keys(theme).length) Theme.apply(theme);
  }
  document.getElementById("boot-loading")?.classList.add("hide");

  // Revisión de cambios remotos: en SEGUNDO PLANO, sin esperar (no bloquea
  // la pantalla). Si hay algo nuevo de otro dispositivo, se aplica solo.
  if (typeof Sync !== "undefined") Sync.checkRemoteChanges();

  return session;
}
