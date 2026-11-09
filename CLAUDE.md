# Devbord — guía para Claude Code

Devbord es una app de tableros Kanban (tipo Trello o Jira) para usuarios **técnicos y no técnicos**. La entrada debe ser muy fácil: un onboarding por perfil y plantilla. La app debe sentirse bien de usar. Más adelante se integrará con agentes de IA, GitHub, suites de Google y Microsoft, y herramientas DevOps.

## Reglas de arquitectura (del usuario, no negociables)
1. Stack: **React + Node.js + Tailwind CSS + TypeScript**.
2. Acceso actual: **GitHub Pages** (solo estático). El backend Node no corre en Pages.
3. Patrón **MVC** en web y en API.
4. **Docker** para todo (preparado para Dokploy).
5. Usar las **skills** del proyecto (`.claude/skills`) y las que se añadan.
6. Estética **pixel art moderna con toques Apple**: minimalista y con colores que combinen.
7. Claude gestiona los commits. **Una rama por apartado**.
8. Código **comentado**, estructurado y mantenible.
9. Compatibilidad futura con las APIs de **GitHub, Google y Microsoft** (y sus suites).

## Estructura
```
apps/web        React SPA (Vite). Se publica en GitHub Pages.
apps/api        Node + Express. Corre en Docker/Dokploy, no en Pages.
packages/shared Tipos + schemas zod compartidos (fuente única del modelo de dominio).
docker/         Dockerfiles. docker-compose.yml en la raíz.
```

### MVC en `apps/web/src`
- `models/`: entidades y **repositorios**. `BoardRepository` es la interfaz. Hoy se usa `IndexedDbBoardRepository`. `HttpBoardRepository` reemplazará al anterior cuando la API esté desplegada (se cambia en `models/repositories/index.ts`).
- `controllers/`: stores Zustand y hooks. Toda la lógica de negocio va aquí.
- `views/`: componentes React **presentacionales**. Nunca importan repositorios ni Dexie.
- `design/`: tokens y componentes UI base (pixel + Apple).
- `templates/`: plantillas de tablero por perfil.
- `integrations/`: contratos de proveedores externos (GitHub, Google, Microsoft).
- `views/cursor/`: cursor pixel (sprites, halo, pistas y chispas). Su estado vive en `controllers/cursorController.ts`. Se monta siempre con puntero fino: no se puede apagar (es parte de la marca).
- `models/collab/`: tiempo real de los tableros de **equipo**. `CollabTransport` es la interfaz; hoy usa `P2PTransport` (WebRTC con Trystero, sin servidor, funciona en Pages). El tablero vive en un CRDT de Yjs (`yBoard.ts`) que fusiona ediciones simultáneas. Para el servidor propio: implementar un transporte WebSocket en `apps/api` y elegirlo en `models/collab/index.ts` (`VITE_COLLAB_URL`). Yjs y Trystero se cargan solo al abrir un tablero de equipo.
- **Apariencia**: la app es **solo modo oscuro** (`data-theme="dark"` en index.html). Los tableros pueden llevar un **tema de temporada** (`Board.skin`: halloween, christmas) con aspecto fijo, sin claro/oscuro: `controllers/themeController` pone `data-skin`, `design/skins.css` cambia tokens, columnas (`.kb-col`), tarjetas (`.kb-card`) y cursor, `views/board/SkinBackdrop` dibuja el fondo y los sprites son rejillas de texto en `design/skinSprites.ts`. El botón de la barra superior reduce animaciones (`controllers/motionController`, guarda la elección).
- **Estanque de patitos** (inicio): `views/components/DuckPond` + `pondPhysics` (agua con ondas y patitos que chocan). Un patito por persona o agente en línea: `controllers/lobbyController` entra en una sala pública del mismo transporte P2P y solo anuncia `kind` (user/agent), nunca nombres ni datos.
- `views/team/`: presencia (avatares, estado, Invitar), cursores remotos y petición de nombre.
- `views/sketch/` + `models/sketch/` + `controllers/sketchController.ts`: **pizarra** superpuesta al tablero (trazos, formas, texto y notas adhesivas). Vive en un documento Yjs: local para tableros individuales (`docStore`, clave `sketch:<id>`) y dentro del documento de colaboración para los de equipo, así se sincroniza en vivo por la misma sesión. Deshacer con `Y.UndoManager` (solo lo propio). Se carga bajo demanda. Los tableros individuales tienen **varias pizarras** (`SketchBook`, lista en `sketch.sheets` del mismo documento) con selector; los de equipo comparten **una sola** pizarra a propósito (sin selector, para no desorientar al equipo). En equipo, la presencia lleva el puntero de la pizarra (`pen`, con `laser`) y la nota que cada uno edita (`editingNote`).
- Tableros **individuales** y **de equipo** se eligen al crear (`Board.mode`) y nunca se mezclan: se listan por separado.

### MVC en `apps/api/src`
`routes → controllers → services → models`. La validación usa los schemas de `@devbord/shared`.

## Git
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- **Ramas por apartado** (permanentes, una por área de la app). Todo cambio se hace en la rama de su área y **se hace push a esa rama directamente**, sin preguntar:
  | Rama | Apartado |
  |---|---|
  | `area/shared` | `packages/shared`: modelo de dominio, schemas, operaciones puras |
  | `area/design` | `apps/web/src/design` + `views/cursor`: tokens, componentes base, animaciones, cursor pixel |
  | `area/board` | `views/board`, `controllers/boardController`: tablero, columnas, tarjetas, DnD, estados |
  | `area/boards` | `views/pages`, `views/components`, `templates`, `models/boardFile`: inicio, onboarding, plantillas, importar/exportar |
  | `area/collab` | `models/collab`, `views/team`, `controllers/collab*`, `controllers/identity*`: tableros de equipo en tiempo real |
  | `area/sketch` | `views/sketch`, `models/sketch`, `controllers/sketchController`: pizarra y notas adhesivas |
  | `area/api` | `apps/api` |
  | `area/infra` | Docker, CI/CD, configuración, documentación |
- Un cambio que toca varias áreas va en la rama del área principal y se menciona en el commit.
- Flujo: `area/*` (push directo) → merge `--no-ff` a **`develop`** (integración; el CI corre en cada push) → **`main` = producción**.
- Antes de empezar en un área: `git switch area/<x> && git merge develop`, para partir de lo último integrado.
- **`main` solo se actualiza con aprobación explícita del usuario**, después de validar en `develop` (lint, typecheck, tests, build y prueba en el navegador). Cada push a `main` despliega GitHub Pages.
- Las ramas `feat/*` y `fix/*` antiguas son historial; no se usan para trabajo nuevo.
- **Sin atribución de IA**: nunca añadir `Co-Authored-By` ni "Generated with Claude Code" en commits o PRs. El único autor es la cuenta del usuario (DevKAlpha).

## Código
- TypeScript `strict`. Nada de `any` salvo con un comentario que lo justifique.
- JSDoc en los exports públicos. Los comentarios explican el **por qué**, no el qué.
- Accesibilidad: todo lo arrastrable también se opera con teclado (dnd-kit KeyboardSensor). Usar labels y foco visible.
- Mobile-first.
- Animaciones: usar los helpers de `design/motion.ts` (`animateIn/Out/Land/Flash/Shake`, `flip`). Solo `transform`/`opacity` y `steps()`. Respetar `html[data-motion="lite"]` (solo hardware modesto; el ajuste "reducir movimiento" del SO no las apaga, decisión de producto): nada de bucles decorativos ni filtros en lite.
- Estados de tarjeta (telaraña, caliente, congelada): lógica pura en `views/board/cardMood.ts`, sprites en `MoodDecor.tsx`.

## Comandos
```
npm install
npm run dev        # web en http://localhost:5173
npm run dev:api    # api en http://localhost:3000
npm run lint && npm run typecheck && npm test
npm run build
docker compose up --build   # web :8080, api :3000
```

## Skills / MCP en uso
- `ponytail`: cambio mínimo, sin sobre-ingeniería.
- `graphify`: grafo de conocimiento del código (`graphify-out/`, ignorado en git).
- `caveman`: estilo de respuesta en chat. No afecta al código ni a los commits.
- `code-review`, `simplify`: antes de mergear ramas grandes.
- MCP: Claude Docs, Google Drive (disponibles). _Añadir aquí los nuevos con su propósito._
