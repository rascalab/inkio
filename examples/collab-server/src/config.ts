import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { IncomingMessage, MessageType, type Configuration, type Document } from '@hocuspocus/server';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { isRoomId, isToken, MAX_ACTIVE_ROOMS, MAX_FRAME_BYTES, MAX_ROOM_CONNECTIONS, MAX_SNAPSHOT_BYTES } from './limits';
import { readSnapshot, storeSnapshot } from './snapshots';

/** `'write'` / `'read'` grants access (read = server-enforced read-only); false rejects. */
export type CollabAccess = 'write' | 'read' | false;

export type CollabVerifyFn = (token: string, docId: string, request?: Request) => CollabAccess | Promise<CollabAccess>;

export interface InkioCollabOptions {
  /** An existing, private directory owned by a single sync process. */
  dataDir: string;
  /** Resolve the caller and check the specific document on every new connection. */
  verify: CollabVerifyFn;
  /** Exact allowed browser Origins. Non-browser clients may omit Origin. */
  allowedOrigins?: readonly string[];
  /** Coalesce writes to disk (ms). */
  debounce?: number;
}

const ACCESS_DENIED = { reason: 'inkio:access-denied' };
const UNAVAILABLE = { reason: 'inkio:temporarily-unavailable' };

function safePosition(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const { type, item, tname, assoc } = value as Record<string, unknown>;
  const id = (part: unknown) => {
    if (!part || typeof part !== 'object') return false;
    const { client, clock } = part as Record<string, unknown>;
    return typeof client === 'number' && Number.isSafeInteger(client) && client >= 0 &&
      typeof clock === 'number' && Number.isSafeInteger(clock) && clock >= 0;
  };
  return (type == null || id(type)) && (item == null || id(item)) &&
    (tname == null || (typeof tname === 'string' && tname.length <= 128)) &&
    (assoc == null || Number.isSafeInteger(assoc));
}

/** Hocuspocus configuration shared by the standalone and embedded servers. */
export function createCollabConfiguration(options: InkioCollabOptions): Partial<Configuration> {
  const { verify, allowedOrigins, debounce = 2000 } = options;
  if (typeof verify !== 'function') throw new Error('[collab] a document-scoped verify function is required');
  if (!options.dataDir?.trim()) throw new Error('[collab] dataDir is required');
  const dataDir = resolve(options.dataDir);
  if (!statSync(dataDir).isDirectory()) throw new Error('[collab] dataDir must be an existing directory');
  if (!Number.isInteger(debounce) || debounce < 0 || debounce > 10_000) {
    throw new Error('[collab] debounce must be an integer from 0 to 10000');
  }
  const origins = allowedOrigins && new Set(allowedOrigins);
  const updateBytes = new WeakMap<Document, number>();
  const lastStoreError = new Set<string>();
  return {
    quiet: true,
    debounce,
    maxUnauthenticatedQueueSize: MAX_FRAME_BYTES,
    maxUnauthenticatedQueueMessages: 32,
    maxPendingDocuments: 8,
    async onAuthenticate({ token, documentName, connectionConfig, request, instance }) {
      if (!isRoomId(documentName) || !isToken(token)) throw ACCESS_DENIED;
      const origin = request.headers.get('origin');
      if (origin !== null && origins && !origins.has(origin)) throw ACCESS_DENIED;
      let access: CollabAccess;
      try {
        access = await verify(token, documentName, request);
      } catch {
        throw UNAVAILABLE;
      }
      if (access !== 'write' && access !== 'read') throw ACCESS_DENIED;
      const room = instance.documents.get(documentName);
      if (room && room.getConnectionsCount() >= MAX_ROOM_CONNECTIONS) throw UNAVAILABLE;
      connectionConfig.readOnly = access === 'read';
    },
    async onCreateDocument({ documentName, instance }) {
      if (!isRoomId(documentName)) throw ACCESS_DENIED;
      if (instance.getDocumentsCount() + instance.loadingDocuments.size > MAX_ACTIVE_ROOMS) throw UNAVAILABLE;
    },
    async onLoadDocument({ documentName, document }) {
      try {
        const bytes = await readSnapshot(dataDir, documentName);
        if (bytes) applyUpdate(document, bytes);
        updateBytes.set(document, bytes?.byteLength ?? 0);
      } catch (error) {
        document.destroy();
        console.error('[collab] snapshot could not be loaded', error);
        throw UNAVAILABLE;
      }
    },
    async beforeHandleMessage({ update }) {
      if (update.byteLength <= 4096) return;
      const message = new IncomingMessage(update);
      message.readVarString();
      if (message.readVarUint() === MessageType.Awareness) {
        throw { code: 1009, reason: 'Presence update too large' };
      }
    },
    async beforeHandleAwareness({ states, connection, document, awareness }) {
      if (!connection) return;
      const owned = document.getClients(connection);
      let hasPeer = owned.size > 0;
      for (const [id, state] of states) {
        const user = state?.user;
        const cursor = state?.cursor;
        if (!Number.isSafeInteger(id) || id < 0 || id > 0xffffffff ||
          (!owned.has(id) && (hasPeer || awareness.getStates().has(id))) ||
          (!user && !cursor)) {
          states.delete(id);
          continue;
        }
        const safe: Record<string, unknown> = {};
        if (typeof user?.name === 'string') {
          const name = user.name.slice(0, 80).replace(/[\p{Cc}\p{Cf}]+/gu, '').trim();
          if (name) safe.user = { name, color: typeof user.color === 'string' &&
            /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(user.color) ? user.color : '#888888' };
        }
        if (safePosition(cursor?.anchor) && safePosition(cursor?.head)) {
          safe.cursor = { anchor: cursor.anchor, head: cursor.head };
        }
        if (!safe.user && !safe.cursor) states.delete(id);
        else {
          states.set(id, safe);
          hasPeer = true;
        }
      }
    },
    async beforeSync({ connection, document, type, payload }) {
      // Step 1 is a state vector. Only count changes from authorized writers.
      if (type === 0 || connection.readOnly) return;
      let bytes = updateBytes.get(document) ?? 0;
      if (bytes + payload.byteLength > MAX_SNAPSHOT_BYTES) bytes = encodeStateAsUpdate(document).byteLength;
      if (bytes + payload.byteLength > MAX_SNAPSHOT_BYTES) {
        throw { code: 1009, reason: 'Document exceeds storage limit' };
      }
      updateBytes.set(document, bytes + payload.byteLength);
    },
    async onStoreDocument({ documentName, document }) {
      const bytes = encodeStateAsUpdate(document);
      updateBytes.set(document, bytes.byteLength);
      try {
        await storeSnapshot(dataDir, documentName, bytes);
        lastStoreError.delete(documentName);
      } catch (error) {
        lastStoreError.add(documentName);
        throw error;
      }
    },
    async onDestroy() {
      if (lastStoreError.size) throw new Error('[collab] one or more snapshots could not be persisted');
    },
  };
}
