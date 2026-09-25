import { IndexeddbPersistence } from 'y-indexeddb';
import type * as Y from 'yjs';
import { isYDocEmpty } from './ydoc';

export function persistDocToIndexedDB(docId: string, doc: Y.Doc): IndexeddbPersistence {
  return new IndexeddbPersistence(docId, doc);
}

export async function loadIndexedDBState(docId: string, doc: Y.Doc): Promise<boolean> {
  const persistence = new IndexeddbPersistence(docId, doc);
  await persistence.whenSynced;
  const hasData = !isYDocEmpty(doc);
  persistence.destroy();
  return hasData;
}
