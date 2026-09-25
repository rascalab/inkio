import { io } from 'socket.io-client';
import * as Y from 'yjs';

const PORT = Number(process.env.PORT ?? 3123);
const URL = `http://127.0.0.1:${PORT}/inkio-collab`;
const DOC_ID = 'smoke-doc';

const EV = {
  join: 'inkio:collab:join',
  update: 'inkio:collab:update',
  init: 'inkio:collab:init',
};

function waitFor(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, done);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    const done = (payload) => {
      clearTimeout(timer);
      socket.off(event, done);
      resolve(payload);
    };
    socket.on(event, done);
  });
}

async function main() {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const socketA = io(URL, { autoConnect: false });
  const socketB = io(URL, { autoConnect: false });

  docA.on('update', (update) => {
    socketA.emit(EV.update, { docId: DOC_ID, update });
  });
  socketB.on(EV.update, (msg) => {
    if (msg.docId === DOC_ID) Y.applyUpdate(docB, msg.update);
  });

  socketA.connect();
  socketB.connect();
  await Promise.all([
    waitFor(socketA, 'connect').then(() => socketA.emit(EV.join, { docId: DOC_ID })),
    waitFor(socketB, 'connect').then(() => socketB.emit(EV.join, { docId: DOC_ID })),
  ]);
  await Promise.all([waitFor(socketA, EV.init), waitFor(socketB, EV.init)]);
  console.log('smoke: both clients joined and received init');

  const converged = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('docB did not converge')), 5000);
    docB.on('update', () => {
      if (docB.getText('smoke').toString() === 'hello collab') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  docA.getText('smoke').insert(0, 'hello collab');
  await converged;
  console.log('smoke: PASS docB converged via gateway relay');

  socketA.disconnect();
  socketB.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(`smoke: FAIL ${error?.message ?? error}`);
  process.exit(1);
});
