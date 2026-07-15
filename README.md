# Libro — App de contabilidad personal

App 100% estática (HTML/CSS/JS). Base de datos SQLite real en el navegador
(sql.js), cifrada con AES-256 y guardada en IndexedDB. Sincronización opcional
y cifrada con Google Sheets.

## Probar ahora mismo (local)

sql.js necesita cargarse por `http://`, no funciona abriendo el archivo
directo (`file://`). Usa un servidor local simple:

```
cd contapp
python3 -m http.server 8080
```

Abre `http://localhost:8080` → crea tu usuario administrador (pestaña
"Crear cuenta") → ya puedes probar todas las páginas.

(Alternativa sin Python: extensión "Live Server" de VS Code, o `npx serve`.)

## Publicar en GitHub Pages

1. Crea un repositorio y sube el contenido de la carpeta `contapp/`.
2. Repo → Settings → Pages → Source: rama `main`, carpeta `/root`.
3. Tu app quedará en `https://tu-usuario.github.io/tu-repo/`.

## Configurar sincronización con Google Sheets (opcional)

1. Crea una hoja de cálculo nueva en Google Sheets y crea 3 pestañas con
   estos nombres exactos: `movimientos`, `categorias`, `presupuestos`.
   Copia el ID de la hoja (está en la URL, entre `/d/` y `/edit`).
2. Ve a [Google Cloud Console](https://console.cloud.google.com/) → crea un
   proyecto → **APIs y servicios → Biblioteca** → activa "Google Sheets API".
3. **APIs y servicios → Credenciales**:
   - Crea una **API key**.
   - Crea un **ID de cliente OAuth** tipo "Aplicación web", y agrega como
     "Orígenes autorizados de JavaScript" la URL de tu GitHub Pages
     (y `http://localhost:8080` si quieres probar en local).
4. En la app: Ajustes → Sincronización con Google Sheets → pega el Client
   ID, la API Key y el ID de la hoja → Guardar → Conectar y sincronizar ahora.

Cada valor se cifra (AES-256) antes de subirse, así que el Sheet solo
mostrará texto ilegible — solo tu app, con la contraseña correcta, puede leerlo.

## Notas de seguridad importantes

- Todos los usuarios comparten el mismo libro contable, cifrado con una
  llave de datos común. Cada usuario guarda su propia copia de esa llave,
  protegida por su propia contraseña — por eso el administrador puede
  restablecer la contraseña de cualquiera sin perder los datos.
- **Si el administrador también olvida su contraseña y no hay otro usuario
  activo, los datos no se pueden recuperar.** Guarda tus contraseñas en un
  lugar seguro.
- "Recuérdame" guarda la llave de sesión cifrada solo en ese navegador/
  dispositivo (localStorage). Cerrar sesión o usar "Olvidar este
  dispositivo" la borra.
- El sistema de apariencia (Ajustes → capas) se guarda en tu navegador y no
  es información sensible.

## Estructura del proyecto

```
contapp/
  index.html          login / registro
  dashboard.html       resumen del mes
  transacciones.html   ingresos y gastos
  presupuestos.html    metas por categoría
  reportes.html        gráficas y comparativa mensual
  categorias.html      categorías de ingreso/gasto
  ajustes.html         capas visuales, usuarios, Google Sheets
  css/variables.css    TODAS las capas visuales configurables
  css/style.css        layout y componentes
  js/crypto.js         hash + AES-256 (Web Crypto API)
  js/db.js             SQLite (sql.js) + persistencia cifrada
  js/auth.js           usuarios, sesión, reset de contraseña
  js/theme.js          panel de apariencia
  js/sheets.js         sincronización cifrada con Google Sheets
  js/nav.js            barra lateral + protección de páginas
```
