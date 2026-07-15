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

  document.getElementById("sidebar-mount").innerHTML = `
    <div class="brand">
      <span class="ledger-mark"></span>Libro
      <span id="sync-led" style="width:9px;height:9px;border-radius:50%;background:var(--accent-danger);margin-left:2px"></span>
    </div>
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
    </div>`;

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    Auth.logout();
    Auth.forgetDevice();
    location.href = "index.html";
  });
}

// Toda página protegida llama a esto al cargar
async function guardPage() {
  const session = await Auth.restoreSession();
  if (!session) { location.href = "index.html"; return null; }
  renderSidebar(location.pathname.split("/").pop(), session);
  if (typeof Sync !== "undefined") Sync.setLed(document.getElementById("sync-led"), session.dataKey);
  return session;
}
