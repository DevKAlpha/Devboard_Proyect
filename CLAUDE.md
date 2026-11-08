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
- `views/cursor/`: cursor pixel (sprites, halo, pistas y chispas). Su estado vive en `controllers/cursorController.ts`. Se monta solo con puntero fino y se puede apagar desde la barra lateral.
- `models/collab/`: tiempo real de los tableros de **equipo**. `CollabTransport` es la interfaz; hoy usa `P2PTransport` (WebRTC con Trystero, sin servidor, funciona en Pages). El tablero vive en un CRDT de Yjs (`yBoard.ts`) que fusiona ediciones simultáneas. Para el servidor propio: implementar un transporte WebSocket en `apps/api` y elegirlo en `models/collab/index.ts` (`VITE_COLLAB_URL`). Yjs y Trystero se cargan solo al abrir un tablero de equipo.
- `views/team/`: presencia (avatares, estado, Invitar), cursores remotos y petición de nombre.
- Tableros **individuales** y **de equipo** se eligen al crear (`Board.mode`) y nunca se mezclan: se listan por separado.

### MVC en `apps/api/src`
`routes → controllers → services → models`. La validación usa los schemas de `@devbord/shared`.

## Git
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Ramas: `feat/<tema>`, `fix/<tema>`, `chore/<tema>`, `ci/<tema>`. Merge a `main` con `--no-ff`. La rama se conserva.
- **No hacer push** sin confirmación explícita del usuario.
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
