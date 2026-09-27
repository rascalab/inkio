import { createInkioCollabServer } from './server';

// DEVELOPMENT DEFAULTS ONLY: no `verify` is wired, so anyone can read and
// write any document. Pass a `verify` token check before exposing this.
async function bootstrap() {
  const portRaw = process.env.PORT ?? '3123';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new Error(`[collab] invalid PORT: ${JSON.stringify(portRaw)}`);
  }
  const dataDir = process.env.DATA_DIR ?? './data';
  const server = createInkioCollabServer({ port, dataDir });
  await server.listen();
  console.log(`[collab] listening on ws://localhost:${port} (data: ${dataDir})`);
}

void bootstrap();
