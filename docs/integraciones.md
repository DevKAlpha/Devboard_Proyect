# Conexiones: Google, Microsoft y Slack

El panel **Conexiones** del tablero conecta Devbord con herramientas de trabajo. Todo corre en el navegador: funciona en GitHub Pages y no necesita servidor.

| Qué                                                           | Necesita configuración                      | Dónde vive                                                                 |
| ------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| Adjuntar archivos (Drive, Docs, OneDrive, SharePoint, Slack…) | No. Basta con pegar el enlace en la tarjeta | En la tarjeta (`Card.links`)                                               |
| Fecha al calendario (enlace o archivo .ics)                   | No                                          | —                                                                          |
| Crear el evento directamente en Google Calendar u Outlook     | Sí, un Client ID por proveedor (abajo)      | Token en `sessionStorage`; se borra al cerrar la pestaña                   |
| Avisos en Slack                                               | Un webhook por tablero, pegado en el panel  | `localStorage` del navegador. No se sincroniza con el equipo ni se exporta |

Cada conexión declara sus **herramientas** con la forma de las de MCP (nombre, descripción, JSON Schema). Están en `apps/web/src/integrations/connections.ts`. La interfaz ya las usa, y un agente de IA o un servidor MCP en `apps/api` podrá usarlas más adelante.

## URLs de retorno (las piden Google y Microsoft)

Hay que registrar las dos URLs:

- Producción: `https://devkalpha.github.io/Devboard_Proyect/oauth.html`
- Desarrollo: `http://localhost:5173/oauth.html`

Si publicas en otro dominio (Docker o Dokploy), añade también `https://<tu-dominio>/oauth.html`.

## Google (Calendar)

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.
2. En **APIs y servicios › Biblioteca**, activa la **Google Calendar API**.
3. Configura la **Pantalla de consentimiento de OAuth**:
   - Tipo: Externo.
   - Datos: nombre de la app y correo de soporte.
   - Permiso: `https://www.googleapis.com/auth/calendar.events`.
   - Mientras la app esté en modo **Prueba**, añade como _usuarios de prueba_ las cuentas que la usarán. Para abrirla a cualquiera, Google exige verificar la app, porque este permiso es sensible.
4. En **Credenciales › Crear credenciales › ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - Orígenes de JavaScript autorizados: `https://devkalpha.github.io` y `http://localhost:5173`.
   - URIs de redireccionamiento autorizados: las dos URLs de retorno de arriba.
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`). Ese es `VITE_GOOGLE_CLIENT_ID`.

## Microsoft (Outlook / Microsoft 365)

1. Entra en el [Centro de administración de Microsoft Entra](https://entra.microsoft.com/) y abre **Aplicaciones › Registros de aplicaciones › Nuevo registro**.
2. En _Tipos de cuenta_, elige **cuentas de cualquier directorio organizativo y cuentas personales de Microsoft**. Devbord usa el endpoint `common`.
3. En _URI de redirección_, elige la plataforma **Aplicación de página única (SPA)** y añade las dos URLs de retorno de arriba. Tiene que ser SPA: así el flujo PKCE funciona sin secreto.
4. En **Permisos de API**, añade **Microsoft Graph › Permisos delegados › `Calendars.ReadWrite`**.
5. Copia el **Id. de aplicación (cliente)**. Ese es `VITE_MS_CLIENT_ID`.

## Poner los IDs en Devbord

Los Client ID son públicos (van dentro de la web), no son secretos.

- **GitHub Pages**: en el repo, abre **Settings › Secrets and variables › Actions › Variables** y crea `VITE_GOOGLE_CLIENT_ID` y `VITE_MS_CLIENT_ID`. El siguiente despliegue a `main` los incluye.
- **Local**: crea `apps/web/.env.local` con las dos variables (mira `apps/web/.env.example`).
- **Docker**: expórtalas antes de `docker compose up --build`; `docker-compose.yml` las pasa al build.

Sin IDs, el panel muestra la cuenta como _Sin configurar_, y los botones de calendario abren la pantalla de "nuevo evento" ya rellenada.

## Slack (avisos)

1. En Slack, ve a **Apps › Incoming Webhooks** (o crea una app en <https://api.slack.com/apps> y activa _Incoming Webhooks_).
2. Elige **Añadir a un canal** y copia la URL (`https://hooks.slack.com/services/…`).
3. En Devbord, abre el tablero y ve a **Conexiones › Slack**:
   - Pega la URL.
   - Elige cuándo avisar: cada cambio de columna o solo al terminar, es decir, al llegar a la última columna.
   - Pulsa **Probar**.

La URL del webhook es un secreto: quien la tenga puede escribir en el canal. Por eso se guarda solo en ese navegador. En tableros de equipo avisa quien mueve la tarjeta, si tiene el canal configurado. Así el aviso no se repite.
