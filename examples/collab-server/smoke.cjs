// Self-contained smoke for both hosting modes. Boots each in-process on a
// free port: clients converge, a restart reloads the persisted snapshot,
// and (Nest) auth + read-only are enforced next to a normal HTTP route.
require('reflect-metadata');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Controller, Get, Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { HocuspocusProvider } = require('@hocuspocus/provider');
const { createInkioCollabServer, InkioCollabModule } = require('./dist/index.js');

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

async function converge(url, docId, token) {
  const a = new HocuspocusProvider({ url, name: docId, token });
  const b = new HocuspocusProvider({ url, name: docId, token });
  await until(() => a.isSynced && b.isSynced, 'initial sync');
  a.document.getText('smoke').insert(0, 'hello collab');
  await until(() => text(b) === 'hello collab', 'relay');
  a.destroy();
  b.destroy();
}

async function reload(url, docId, token) {
  const c = new HocuspocusProvider({ url, name: docId, token });
  await until(() => c.isSynced && text(c) === 'hello collab', 'persisted reload');
  c.destroy();
}

async function standalone(dataDir) {
  const boot = async () => {
    const server = createInkioCollabServer({ port: 0, dataDir, debounce: 0 });
    await server.listen();
    return { server, url: `ws://127.0.0.1:${server.address.port}` };
  };
  let { server, url } = await boot();
  await converge(url, 'standalone-doc');
  await server.destroy();
  ({ server, url } = await boot());
  await reload(url, 'standalone-doc');
  await server.destroy();
  console.log('smoke: PASS standalone (sync + restart reload)');
}

async function nest(dataDir) {
  class HealthController {
    health() {
      return 'ok';
    }
  }
  Get('health')(HealthController.prototype, 'health', Object.getOwnPropertyDescriptor(HealthController.prototype, 'health'));
  Controller()(HealthController);

  const verify = (token) => (token === 'editor' ? 'write' : token === 'viewer' ? 'read' : false);
  class AppModule {}
  Module({
    imports: [InkioCollabModule.forRoot({ dataDir, debounce: 0, verify })],
    controllers: [HealthController],
  })(AppModule);

  const boot = async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address();
    return { app, base: `127.0.0.1:${port}` };
  };

  let { app, base } = await boot();
  const health = await fetch(`http://${base}/health`).then((r) => r.text());
  if (health !== 'ok') throw new Error(`http route broken: ${health}`);
  const url = `ws://${base}/collab`;
  await converge(url, 'nest-doc', 'editor');

  const denied = new HocuspocusProvider({ url, name: 'nest-doc', token: 'nobody' });
  let rejected = false;
  denied.on('authenticationFailed', () => { rejected = true; });
  await until(() => rejected, 'unauthorized rejected');
  denied.destroy();

  const viewer = new HocuspocusProvider({ url, name: 'nest-doc', token: 'viewer' });
  const editor = new HocuspocusProvider({ url, name: 'nest-doc', token: 'editor' });
  await until(() => viewer.isSynced && editor.isSynced && viewer.authorizedScope === 'readonly', 'viewer sync');
  viewer.document.getText('ro').insert(0, 'sneaky');
  await new Promise((r) => setTimeout(r, 300));
  if (editor.document.getText('ro').toString() !== '') throw new Error('read-only write leaked');
  viewer.destroy();
  editor.destroy();

  await app.close();
  ({ app, base } = await boot());
  await reload(`ws://${base}/collab`, 'nest-doc', 'editor');
  await app.close();
  console.log('smoke: PASS nest embed (http route + ws, auth, read-only, restart reload)');
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'inkio-collab-'));
  try {
    await standalone(join(dataDir, 'standalone'));
    await nest(join(dataDir, 'nest'));
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
