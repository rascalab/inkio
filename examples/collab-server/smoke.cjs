// Positive sync, scoped access and a cold restart in all three hosting modes.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { mkdir, mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Controller, Get, Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { HocuspocusProvider } = require('@hocuspocus/provider');
const { createInkioCollabServer, InkioCollabModule, createVerifyApplication } = require('./dist/index.js');

const docId = 'Team-협업';
const editorToken = randomBytes(32).toString('hex');
const viewerToken = randomBytes(32).toString('hex');
const serviceKey = randomBytes(32).toString('hex');
const verify = (token, room) => {
  if (room !== docId) return false;
  return token === editorToken ? 'write' : token === viewerToken ? 'read' : false;
};

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

const text = (provider) => provider.document.getText('smoke').toString();

async function writeAndStop(url, stop) {
  const editor = new HocuspocusProvider({ url, name: docId, token: editorToken });
  const viewer = new HocuspocusProvider({ url, name: docId, token: viewerToken });
  const notShared = new HocuspocusProvider({ url, name: 'other-team', token: editorToken });
  try {
    let denied;
    notShared.on('authenticationFailed', ({ reason }) => { denied = reason; });
    await until(() => denied !== undefined, 'document ACL');
    assert.equal(denied, 'inkio:access-denied');
    assert.equal(notShared.isSynced, false);
    await until(() => editor.isSynced && viewer.isSynced, 'initial sync');
    assert.equal(editor.authorizedScope, 'read-write');
    assert.equal(viewer.authorizedScope, 'readonly');
    editor.document.getText('smoke').insert(0, 'hello collab');
    await until(() => text(viewer) === 'hello collab' && !editor.hasUnsyncedChanges, 'relay acknowledged');
    // Close the host with both clients attached and while its store is debounced.
    await stop();
  } finally {
    notShared.destroy();
    viewer.destroy();
    editor.destroy();
  }
}

async function reload(url, dataDir) {
  const name = createHash('sha256').update(docId).digest('hex');
  const bytes = await readFile(join(dataDir, `v2-${name}.ydoc`));
  assert.ok(bytes.length > 0);
  const viewer = new HocuspocusProvider({ url, name: docId, token: viewerToken });
  try {
    await until(() => viewer.isSynced && text(viewer) === 'hello collab', 'persisted reload');
  } finally {
    viewer.destroy();
  }
}

async function verifyRestart(boot, dataDir) {
  await mkdir(dataDir);
  let host = await boot();
  try {
    await writeAndStop(host.url, host.stop);
    host = await boot();
    await reload(host.url, dataDir);
  } finally {
    await host.stop();
  }
}

async function standalone(dataDir) {
  await verifyRestart(async () => {
    const server = createInkioCollabServer({ port: 0, dataDir, verify, debounce: 10_000 });
    await server.listen();
    assert.equal(server.address.address, '127.0.0.1');
    return { url: server.webSocketURL, stop: () => server.destroy() };
  }, dataDir);
  console.log('smoke: PASS standalone (scoped auth, sync, restart)');
}

async function nest(dataDir) {
  class HealthController {
    health() {
      return 'ok';
    }
  }
  Get('health')(HealthController.prototype, 'health', Object.getOwnPropertyDescriptor(HealthController.prototype, 'health'));
  Controller()(HealthController);

  const config = { dataDir, verify, debounce: 10_000 };
  class AppModule {}
  Module({
    imports: [InkioCollabModule.forRoot(config)],
    controllers: [HealthController],
  })(AppModule);

  await verifyRestart(async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const base = `127.0.0.1:${app.getHttpServer().address().port}`;
    let stopping;
    try {
      const response = await fetch(`http://${base}/health`, { signal: AbortSignal.timeout(5000) });
      assert.equal(await response.text(), 'ok');
    } catch (error) {
      await app.close();
      throw error;
    }
    return { url: `ws://${base}/collab`, stop: () => (stopping ??= app.close()) };
  }, dataDir);
  console.log('smoke: PASS embed (scoped auth, sync, restart)');
}

async function bootSplit(dataDir, apiPort) {
  const child = spawn(process.execPath, [join(__dirname, 'dist', 'sync-main.js')], {
    env: {
      ...process.env,
      PORT: '0',
      COLLAB_HOST: '127.0.0.1',
      COLLAB_ALLOWED_ORIGINS: 'http://localhost:3000',
      DATA_DIR: dataDir,
      VERIFY_URL: `http://127.0.0.1:${apiPort}/collab/verify`,
      COLLAB_VERIFY_KEY: serviceKey,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  let errors = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const port = () => /standalone sync listening on 127\.0\.0\.1:(\d+)/.exec(output)?.[1];
  let stopping;
  const stop = () => (stopping ??= (async () => {
    child.kill('SIGTERM');
    const deadline = setTimeout(() => child.kill('SIGKILL'), 7000);
    try {
      const [code, signal] = await exited;
      assert.equal(code, 0, `sync process did not exit cleanly (${signal}): ${errors}`);
    } finally {
      clearTimeout(deadline);
    }
  })());
  try {
    await Promise.race([
      until(() => !!port(), 'split sync startup'),
      exited.then(() => { throw new Error(`sync exited during startup: ${errors}`); }),
    ]);
    return { url: `ws://127.0.0.1:${port()}`, stop };
  } catch (error) {
    await stop().catch(() => {});
    throw error;
  }
}

async function split(dataDir) {
  const app = await createVerifyApplication(verify, serviceKey);
  await app.listen(0, '127.0.0.1');
  const apiPort = app.getHttpServer().address().port;
  try {
    await verifyRestart(() => bootSplit(dataDir, apiPort), dataDir);
  } finally {
    await app.close();
  }
  console.log('smoke: PASS split (private verifier, scoped auth, sync, SIGTERM restart)');
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'inkio-collab-'));
  try {
    await standalone(join(dataDir, 'standalone'));
    await nest(join(dataDir, 'nest'));
    await split(join(dataDir, 'split'));
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(`smoke: FAIL ${error?.stack ?? error}`);
    process.exit(1);
  },
);
