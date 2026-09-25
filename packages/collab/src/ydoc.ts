import * as Y from 'yjs';

export const INKIO_REMOTE_ORIGIN = 'inkio-collab-remote';

export function createYDoc(): Y.Doc {
  return new Y.Doc();
}

export function isYDocEmpty(doc: Y.Doc): boolean {
  return Y.encodeStateAsUpdate(doc).length <= 2;
}

export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function applyRemoteUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update, INKIO_REMOTE_ORIGIN);
}
