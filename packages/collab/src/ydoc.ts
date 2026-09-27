import * as Y from 'yjs';

export function createYDoc(): Y.Doc {
  return new Y.Doc();
}

/** True when no client has ever written to the doc (cheaper than encoding it). */
export function isYDocEmpty(doc: Y.Doc): boolean {
  return doc.store.clients.size === 0;
}

export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}
