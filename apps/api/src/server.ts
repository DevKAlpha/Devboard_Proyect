/** Process entry point: starts HTTP and shuts down cleanly on SIGTERM (Docker / Dokploy). */
import { createApp } from './app';
import { config } from './config';

const server = createApp().listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, closing`);
    server.close(() => process.exit(0));
  });
}
