import { createInkioCollabServer } from './server';
import { createHttpVerify } from './split';

// Split hosting mode, sync half: owns documents and WebSocket traffic only.
// Access checks are delegated to the API process (see api-main.ts).
async function main() {
  const port = Number(process.env.PORT ?? '3123');
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new Error(`[collab] invalid PORT: ${JSON.stringify(process.env.PORT)}`);
  }
  const verifyUrl = process.env.VERIFY_URL ?? 'http://localhost:3100/collab/verify';
  const server = createInkioCollabServer({
    port,
    dataDir: process.env.DATA_DIR ?? './data',
    verify: createHttpVerify({ url: verifyUrl }),
  });
  await server.listen();
  console.log(`[collab] standalone sync on ws://localhost:${port} (verify: ${verifyUrl})`);
}

void main();
