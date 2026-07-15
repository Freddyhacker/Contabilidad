/* ============================================
   theme.js — Define cada "capa" visual configurable
   y su tipo de control. Se guarda en localStorage
   (solo preferencias visuales, no son datos sensibles).
   ============================================ */
const Theme = (() => {
  const KEY = "contapp_theme";

  const LAYERS = [
    { group: "Fondo", items: [
      { varName: "--bg-base", label: "Fondo general", type: "color" },
      { varName: "--bg-panel", label: "Fondo de paneles/tarjetas", type: "color" },
      { varName: "--bg-panel-alt", label: "Fondo secundario", type: "color" },
    ]},
    { group: "Texto", items: [
      { varName: "--text-primary", label: "Color de letra principal", type: "color" },
      { varName: "--text-muted", label: "Color de letra secundaria", type: "color" },
    ]},
    { group: "Acentos", items: [
      { varName: "--accent-income", label: "Color de ingresos", type: "color" },
      { varName: "--accent-expense", label: "Color de gastos", type: "color" },
      { varName: "--accent-danger", label: "Color de alertas", type: "color" },
    ]},
    { group: "Botones", items: [
      { varName: "--btn-bg", label: "Fondo de botón principal", type: "color" },
      { varName: "--btn-text", label: "Color de letra del botón", type: "color" },
      { varName: "--btn-border-color", label: "Contorno del botón", type: "color" },
      { varName: "--btn-border-width", label: "Grosor del contorno (px)", type: "range", min: 0, max: 6, unit: "px" },
      { varName: "--btn-radius", label: "Redondez del botón (px)", type: "range", min: 0, max: 24, unit: "px" },
    ]},
    { group: "Bordes y forma", items: [
      { varName: "--border-color", label: "Color de bordes", type: "color" },
      { varName: "--radius", label: "Redondez general (px)", type: "range", min: 0, max: 24, unit: "px" },
    ]},
  ];

  function defaults() {
    const styles = getComputedStyle(document.documentElement);
    const map = {};
    LAYERS.forEach(g => g.items.forEach(i => {
      map[i.varName] = styles.getPropertyValue(i.varName).trim();
    }));
    return map;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  function apply(values) {
    Object.entries(values).forEach(([k, v]) => {
      if (v) document.documentElement.style.setProperty(k, v);
    });
  }

  function save(values) {
    localStorage.setItem(KEY, JSON.stringify(values));
  }

  function init() {
    apply(load());
  }

  function reset() {
    localStorage.removeItem(KEY);
    location.reload();
  }

  return { LAYERS, defaults, load, apply, save, init, reset };
})();

Theme.init(); // aplica el tema guardado apenas carga cualquier página
