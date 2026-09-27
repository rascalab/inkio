// Self-contained smoke: boots the built server in-process on a free port,
// checks two clients converge, then restarts it and checks the snapshot
// was persisted and reloaded.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Load both sides through CJS so they share one yjs instance.
const { createInkioCollabServer } = require('./dist/server.js');
const { HocuspocusProvider } = require('@hocuspocus/provider');

const DOC_ID = `smoke-doc-${Date.now().toString(36)}`;

function until(check, label, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out: ${label}`));
      setTimeout(tick, 20);
    };
    tick();
  });
}

async function boot(dataDir) {
  const server = createInkioCollabServer({ port: 0, dataDir, debounce: 0 });
  await server.listen();
  return { server, url: `ws://127.0.0.1:${server.address.port}` };
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'inkio-collab-'));
  try {
    let { server, url } = await boot(dataDir);
    const a = new HocuspocusProvider({ url, name: DOC_ID });
    const b = new HocuspocusProvider({ url, name: DOC_ID });
    await until(() => a.isSynced && b.isSynced, 'initial sync');
    a.document.getText('smoke').insert(0, 'hello collab');
    await until(() => b.document.getText('smoke').toString() === 'hello collab', 'relay');
    console.log('smoke: PASS clients converged');
    a.destroy();
    b.destroy();
    await server.destroy();

    ({ server, url } = await boot(dataDir));
    const c = new HocuspocusProvider({ url, name: DOC_ID });
    await until(() => c.isSynced, 'resync after restart');
    await until(() => c.document.getText('smoke').toString() === 'hello collab', 'persisted reload');
    console.log('smoke: PASS snapshot survived restart');
    c.destroy();
    await server.destroy();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(`smoke: FAIL ${error?.message ?? error}`);
    process.exit(1);
  },
);
