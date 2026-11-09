# Devbord

Tableros Kanban para equipos técnicos y no técnicos. Estética pixel art moderna con alma minimalista.

- **Fácil de empezar**: eliges tu perfil y una plantilla, y en segundos tienes un tablero listo.
- **Un tablero, dos lenguajes**: los campos avanzados (tipo, prioridad) solo aparecen si los necesitas.
- **Individual o en equipo**: los tableros de equipo se editan a la vez entre varias personas (cursores en vivo, como Figma) con solo compartir un enlace.
- **Pizarra**: una hoja cuadriculada sobre el tablero para explicar y bocetar con el ratón (lápiz, marcador, flechas, formas, texto) y pegar notas adhesivas con observaciones. Varias pizarras por tablero individual; en equipo, una pizarra compartida donde todos dibujan a la vez, con puntero láser y aviso de quién escribe en cada nota.
- **Importar y exportar**: JSON para mover tableros y PNG para compartir una imagen.
- **Preparado para crecer**: integraciones con GitHub, Google, Microsoft y agentes de IA en el roadmap.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
```

Ver [`CLAUDE.md`](./CLAUDE.md) para la arquitectura (MVC, monorepo) y las convenciones.

## Despliegue

**GitHub Pages**: cada push a `main` ejecuta `.github/workflows/deploy-pages.yml`.
Configuración única: _Settings → Pages → Source: GitHub Actions_. Los datos se guardan en el navegador (IndexedDB).

**Docker / Dokploy**:

```bash
docker compose up --build   # web http://localhost:8080 · api http://localhost:3000/health
```

| Variable       | Dónde     | Uso                                                 |
| -------------- | --------- | --------------------------------------------------- |
| `VITE_BASE`    | build web | Ruta base (`/` o `/<repo>/` en Pages)               |
| `VITE_API_URL` | build web | Si está definida, los tableros se guardan en la API |
| `CORS_ORIGINS` | api       | Orígenes permitidos, separados por comas            |
| `PORT`         | api       | Puerto HTTP (por defecto 3000)                      |
