import { createInkioCollabServer } from './server';
import { createHttpVerify } from './split';
import { listenOptions, originsFromEnv, requiredEnv } from './env';

// Split hosting mode, sync half: owns documents and WebSocket traffic only.
// Access checks are delegated to the API process (see api-main.ts).
async function main() {
  const { port, host } = listenOptions(3123);
  const server = createInkioCollabServer({
    port,
    host,
    dataDir: requiredEnv('DATA_DIR'),
    allowedOrigins: originsFromEnv(),
    verify: createHttpVerify({ url: requiredEnv('VERIFY_URL'), serviceKey: requiredEnv('COLLAB_VERIFY_KEY') }),
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void server.destroy().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    }).finally(() => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    });
  };
  await server.listen();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log(`[collab] standalone sync listening on ${host}:${server.address.port}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : '[collab] sync startup failed');
  process.exitCode = 1;
});
