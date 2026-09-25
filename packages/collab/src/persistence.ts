import { IndexeddbPersistence } from 'y-indexeddb';
import type * as Y from 'yjs';
import { isYDocEmpty } from './ydoc';
import { assertValidDocId } from './provider';

/**
 * Persist a doc to IndexedDB under a validated room key. Returns the live
 * persistence handle: the caller owns its lifecycle and MUST call
 * `.destroy()` when the doc unmounts, otherwise the IDB connection and its
 * update listener leak. Never open two live persistences for one docId —
 * dual writers race on the same Y.Doc.
 */
export function persistDocToIndexedDB(docId: string, doc: Y.Doc): IndexeddbPersistence {
  assertValidDocId(docId);
  return new IndexeddbPersistence(docId, doc);
}

const DEFAULT_IDB_SYNC_TIMEOUT_MS = 5000;

/**
 * Load a persisted snapshot into an empty doc. Fails after `timeoutMs`
 * (IndexedDB can block indefinitely, e.g. private mode) instead of hanging
 * forever; the persistence is always destroyed before returning.
 */
export async function loadIndexedDBState(
  docId: string,
  doc: Y.Doc,
  timeoutMs = DEFAULT_IDB_SYNC_TIMEOUT_MS,
): Promise<boolean> {
  assertValidDocId(docId);
  const persistence = new IndexeddbPersistence(docId, doc);
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        persistence.whenSynced,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`[collab] IndexedDB sync timed out for doc=${docId}`));
          }, timeoutMs);
          (timer as unknown as { unref?: () => void }).unref?.();
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    return !isYDocEmpty(doc);
  } finally {
    persistence.destroy();
  }
}
