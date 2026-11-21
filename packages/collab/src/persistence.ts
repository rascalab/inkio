import { clearDocument, IndexeddbPersistence } from 'y-indexeddb';
import type * as Y from 'yjs';
import { isYDocEmpty } from './ydoc';
import { assertValidDocId } from './doc-id';

/** Opaque account and deployment/tenant identifiers; never use a token. */
export interface CollabCacheScope {
  accountId: string;
  deploymentId: string;
}

export function getCollabCacheKey(docId: string, scope: CollabCacheScope): string {
  assertValidDocId(docId);
  const { accountId, deploymentId } = scope ?? {};
  for (const id of [accountId, deploymentId]) {
    if (typeof id !== 'string' || !id.trim() || id.length > 256) {
      throw new Error('[inkio/collab] IndexedDB requires non-empty accountId and deploymentId (max 256 characters each).');
    }
  }
  return `inkio-collab:v2:${JSON.stringify([deploymentId, accountId, docId])}`;
}

/** Delete a scoped cache after destroying its live persistence handles. */
export function clearCollabCache(docId: string, scope: CollabCacheScope): Promise<void> {
  return clearDocument(getCollabCacheKey(docId, scope));
}

/**
 * Persist a doc to IndexedDB under an account/deployment/room key. The
 * caller must destroy the returned handle on unmount. Never open two live
 * persistences for the same key on one Y.Doc.
 */
export function persistDocToIndexedDB(docId: string, doc: Y.Doc, scope: CollabCacheScope): IndexeddbPersistence {
  return new IndexeddbPersistence(getCollabCacheKey(docId, scope), doc);
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
  scope: CollabCacheScope,
  timeoutMs = DEFAULT_IDB_SYNC_TIMEOUT_MS,
): Promise<boolean> {
  const persistence = persistDocToIndexedDB(docId, doc, scope);
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
      clearTimeout(timer);
    }
    return !isYDocEmpty(doc);
  } finally {
    // A blocked open would otherwise block this timeout's own cleanup.
    void persistence.destroy().catch(() => {});
  }
}
