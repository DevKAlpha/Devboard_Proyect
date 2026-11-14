# Devbord ↔ GitHub Projects

Un tablero de Devbord puede ser el **espejo de un Project (v2) de GitHub**, al estilo de Zenhub:

- Lo que cambias en Devbord se escribe en GitHub.
- Lo que cambia en GitHub aparece en Devbord sin recargar.

GitHub es la fuente de verdad.

**No hace falta ningún README, archivo ni configuración dentro de tu repositorio.** Solo hace falta:

1. Una **GitHub App**: la creas una vez.
2. La **API de Devbord** (`apps/api`) desplegada con HTTPS, por ejemplo en Dokploy.
3. Un **Project v2** con el campo **Status**. Lo tienen todos por defecto.

## Qué se sincroniza

| En Devbord                     | En GitHub                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Columnas                       | Opciones del campo **Status**, en su orden. Los items sin Status van a "Sin estado". Las columnas se crean y renombran en GitHub     |
| Tarjeta nueva                  | **Issue** en el primer repositorio vinculado al Project, añadido al Project. Si el Project no tiene repositorio, se crea un borrador |
| Título, descripción, etiquetas | Título, cuerpo y etiquetas del issue                                                                                                 |
| Mover u ordenar                | Status y posición del item                                                                                                           |
| Llevar a la **última columna** | Cierra el issue. Sacarla de ahí lo reabre                                                                                            |
| Story points                   | Campo numérico **Estimate** (o "Story points" o "Points"). Se redondea a Fibonacci                                                   |
| Sprint                         | Campo **Iteration**                                                                                                                  |
| Fecha límite                   | Campo de fecha **Due date** (o "Target date")                                                                                        |
| Prioridad                      | Campo de selección **Priority**, con opciones High/Medium/Low o P0/P1/P2                                                             |
| Epic                           | Issue padre (**sub-issues**). La epic muestra su progreso                                                                            |
| Asignados                      | Assignees del issue                                                                                                                  |
| PRs                            | Pull requests que cierran el issue. Se muestran con su estado (solo lectura)                                                         |
| Eliminar tarjeta               | Saca el item del Project. **El issue no se borra**                                                                                   |

Lo que no tiene sitio en GitHub se queda en Devbord y no se pierde al sincronizar:

- Límite WIP y descripción de cada columna.
- Tema y estilo del tablero.
- Enlaces y tipo de cada tarjeta.

Los campos opcionales (Estimate, Iteration, fecha, Priority) que no existan en el Project aparecen desactivados en el detalle de la tarjeta.

## 1. Crear la GitHub App

Ve a GitHub, **Settings › Developer settings › GitHub Apps › New GitHub App**. Si es para una organización, entra en la configuración de la organización.

| Campo                            | Valor                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Homepage URL                     | La URL de Devbord, por ejemplo `https://devkalpha.github.io/Devboard_Proyect/` |
| Callback URL                     | `https://<tu-api>/api/github/callback`                                         |
| Expire user authorization tokens | Activado (Devbord los renueva solo)                                            |
| Webhook › Active                 | Activado                                                                       |
| Webhook URL                      | `https://<tu-api>/api/github/webhooks`                                         |
| Webhook secret                   | Un secreto largo y aleatorio: va en `GITHUB_WEBHOOK_SECRET`                    |

Permisos de **repositorio**:

- Issues: _Read & write_.
- Pull requests: _Read-only_.
- Metadata: _Read-only_.

Permisos de **organización**:

- Projects: _Read & write_.

Eventos a los que suscribirse:

- _Issues_, _Issue comment_, _Label_, _Pull request_, _Projects v2 item_ y _Sub issues_.

Después de crearla:

- Apunta el **Client ID** y genera un **Client secret**.
- El "nombre público" (slug) es lo que aparece en `github.com/apps/<slug>`.

Por último, **instálala** (_Install App_) en tu organización o en los repositorios que quieras usar.

## 2. Desplegar la API

Variables de entorno de `apps/api`:

| Variable                                    | Qué es                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Credenciales de la App                                                                          |
| `GITHUB_WEBHOOK_SECRET`                     | El secreto del webhook                                                                          |
| `GITHUB_APP_SLUG`                           | Nombre público de la App, para el enlace "instalar"                                             |
| `SESSION_SECRET`                            | Secreto largo y aleatorio. Cifra los tokens guardados                                           |
| `WEB_URL`                                   | URL pública de la web, sin barra final. Ejemplo: `https://devkalpha.github.io/Devboard_Proyect` |
| `API_URL`                                   | URL pública de esta API. Ejemplo: `https://api.tudominio.com`                                   |
| `CORS_ORIGINS`                              | Origen de la web. Ejemplo: `https://devkalpha.github.io`                                        |
| `DATA_DIR`                                  | Carpeta de la base de sesiones. En Docker es `/data`, montada como volumen                      |

Sin las cinco primeras, `/api/github/*` responde 503 y Devbord muestra GitHub como "sin configurar".

Con `docker compose up --build`, exporta esas variables antes; el compose ya monta el volumen `devbord-data`.

## 3. Conectar la web

Indica a la web dónde está la API:

- **GitHub Pages**: crea la variable de repo `VITE_GITHUB_API_URL` (_Settings › Secrets and variables › Actions › Variables_) con la URL de la API. Se aplica en el siguiente despliegue a `main`.
- **Local**: crea `apps/web/.env.local` con `VITE_GITHUB_API_URL=http://localhost:3000`.

Luego, en Devbord:

1. Pulsa **Conectar Project de GitHub** en el inicio, o ve a **Conexiones › GitHub**.
2. Inicia sesión y elige el Project.

## Tiempo real

- **Projects de organización**: GitHub envía webhooks y el tablero se actualiza al momento.
- **Projects de una cuenta personal**: GitHub no envía webhooks de items. La API revisa cada 30 s los Projects abiertos (`GITHUB_POLL_SECONDS`).
- Si una GitHub App no puede acceder a un Project personal, la lista no lo muestra. En ese caso, usa un Project de organización.

## Seguridad

- El navegador solo guarda un id de sesión opaco. Los tokens de GitHub se quedan en la API, cifrados (AES-256-GCM), y se renuevan antes de caducar.
- Cada cambio se hace **como el usuario que lo hizo**: GitHub lo atribuye a esa persona, "via Devbord".
- Los webhooks se verifican con su firma HMAC (`X-Hub-Signature-256`).

## Probar sin GitHub

`GITHUB_FAKE=1 npm run dev:api` sirve un GitHub falso en memoria: un Project con epics, PR, sprints y prioridades. Arranca la web con `VITE_GITHUB_API_URL=http://localhost:3000` y prueba todo el flujo sin crear la App.
