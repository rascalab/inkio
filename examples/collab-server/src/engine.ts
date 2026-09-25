import type { Namespace, Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  INKIO_COLLAB_NAMESPACE,
  CollabClientEvents,
  CollabServerEvents,
  type CollabAwarenessPayload,
  type CollabJoinPayload,
  type CollabUpdatePayload,
} from '@inkio/collab/protocol';

export type CollabVerifyFn = (
  token: string | undefined,
  docId: string,
) => boolean | Promise<boolean>;

export type CollabPersistFn = (docId: string, update: Uint8Array) => void | Promise<void>;

export interface CollabEngineOptions {
  verify?: CollabVerifyFn;
  onPersist?: CollabPersistFn;
  persistThrottleMs?: number;
  namespace?: string;
  /**
   * Largest accepted client update frame in bytes (reference-server
   * guard against bandwidth amplification). Server snapshots bypass it.
   */
  maxUpdateBytes?: number;
  /**
   * Per-socket relay budget per second in bytes. Drops (never queues)
   * over-budget frames with a `rate-limited` error.
   */
  maxRelayBytesPerSecond?: number;
  /** Cap on live room count; further joins are rejected as `forbidden`. */
  maxRooms?: number;
}

const DEFAULT_PERSIST_THROTTLE_MS = 2000;
const DEFAULT_MAX_UPDATE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_RELAY_BYTES_PER_SECOND = 8 * 1024 * 1024;
const MAX_DOC_ID_LENGTH = 256;

function toUint8Array(update: unknown): Uint8Array | null {
  if (update instanceof Uint8Array) return update;
  if (update instanceof ArrayBuffer) return new Uint8Array(update);
  if (ArrayBuffer.isView(update)) {
    // Cross-realm typed arrays: `instanceof` fails across realms but an
    // indexed copy still succeeds.
    try {
      return Uint8Array.from(update as unknown as ArrayLike<number>);
    } catch {
      return null;
    }
  }
  return null;
}

function validDocId(docId: unknown): docId is string {
  return (
    typeof docId === 'string' && docId.trim() !== '' && docId.length <= MAX_DOC_ID_LENGTH
  );
}

interface SocketBudget {
  windowStart: number;
  bytes: number;
}

export class CollabSyncEngine {
  private readonly docs = new Map<string, Y.Doc>();
  private readonly persistTimers = new Map<string, NodeJS.Timeout>();
  private readonly budgets = new Map<string, SocketBudget>();
  private connectionHandler: ((socket: Socket) => void) | null = null;
  private attachedNamespace: Namespace | null = null;

  constructor(private readonly options: CollabEngineOptions = {}) {}

  get namespace(): string {
    return this.options.namespace ?? INKIO_COLLAB_NAMESPACE;
  }

  attach(server: Server): void {
    const nsp: Namespace = server.of(this.namespace);
    this.attachedNamespace = nsp;
    this.connectionHandler = (socket: Socket) => {
      // One listener set per connection, shared across rooms: joining a
      // second doc must not stack duplicate relays on the socket.
      const joined = new Set<string>();
      socket.on(CollabClientEvents.Join, (payload: CollabJoinPayload) => {
        void this.handleJoin(socket, joined, payload);
      });
      socket.on(CollabClientEvents.Update, (msg: CollabUpdatePayload) => {
        this.handleUpdate(socket, joined, msg);
      });
      socket.on(CollabClientEvents.Awareness, (msg: CollabAwarenessPayload) => {
        this.handleAwareness(socket, joined, msg);
      });
      socket.on('disconnect', () => {
        joined.clear();
        this.budgets.delete(socket.id);
      });
    };
    nsp.on('connection', this.connectionHandler);
  }

  /** Detach listeners and timers for host-server embedding; docs survive. */
  detach(): void {
    if (this.attachedNamespace && this.connectionHandler) {
      this.attachedNamespace.off('connection', this.connectionHandler);
    }
    this.attachedNamespace = null;
    this.connectionHandler = null;
    for (const timer of this.persistTimers.values()) {
      clearTimeout(timer);
    }
    this.persistTimers.clear();
    this.budgets.clear();
  }

  getDoc(docId: string): Y.Doc {
    let doc = this.docs.get(docId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(docId, doc);
    }
    return doc;
  }

  snapshot(docId: string): Uint8Array {
    return Y.encodeStateAsUpdate(this.getDoc(docId));
  }

  private reject(
    socket: Socket,
    docId: string,
    code: 'unauthorized' | 'forbidden' | 'internal' | 'invalid-message' | 'rate-limited',
  ): void {
    socket.emit(CollabServerEvents.Error, { docId, code });
  }

  private checkBudget(socket: Socket, bytes: number): boolean {
    const max = this.options.maxRelayBytesPerSecond ?? DEFAULT_MAX_RELAY_BYTES_PER_SECOND;
    const now = Date.now();
    let budget = this.budgets.get(socket.id);
    if (!budget || now - budget.windowStart >= 1000) {
      budget = { windowStart: now, bytes: 0 };
      this.budgets.set(socket.id, budget);
    }
    budget.bytes += bytes;
    return budget.bytes <= max;
  }

  private async handleJoin(socket: Socket, joined: Set<string>, payload: CollabJoinPayload) {
    if (!payload || !validDocId(payload.docId)) {
      return;
    }
    const { docId } = payload;
    // Re-verify on every join event, including same-doc rejoins after a
    // reconnect: token rotation must take effect (docs promise this).
    let allowed: boolean;
    try {
      allowed = this.options.verify ? await this.options.verify(payload.token, docId) : true;
    } catch {
      this.reject(socket, docId, 'internal');
      return;
    }
    if (!allowed) {
      this.reject(socket, docId, 'unauthorized');
      return;
    }
    if (!joined.has(docId)) {
      if (this.options.maxRooms !== undefined && this.docs.size >= this.options.maxRooms && !this.docs.has(docId)) {
        this.reject(socket, docId, 'forbidden');
        return;
      }
      joined.add(docId);
      socket.join(docId);
    }
    socket.emit(CollabServerEvents.Init, {
      docId,
      update: Y.encodeStateAsUpdate(this.getDoc(docId)),
    });
  }

  private handleUpdate(socket: Socket, joined: Set<string>, msg: CollabUpdatePayload) {
    if (!msg || !validDocId(msg.docId) || !joined.has(msg.docId)) return;
    const bytes = toUint8Array(msg.update);
    const maxUpdate = this.options.maxUpdateBytes ?? DEFAULT_MAX_UPDATE_BYTES;
    if (!bytes || bytes.length > maxUpdate) {
      this.reject(socket, msg.docId, 'invalid-message');
      return;
    }
    if (!this.checkBudget(socket, bytes.length)) {
      this.reject(socket, msg.docId, 'rate-limited');
      return;
    }
    const doc = this.getDoc(msg.docId);
    try {
      Y.applyUpdate(doc, bytes);
    } catch {
      // Malformed frame from one client must not crash the process.
      this.reject(socket, msg.docId, 'invalid-message');
      return;
    }
    socket.to(msg.docId).emit(CollabServerEvents.Update, msg);
    this.schedulePersist(msg.docId);
  }

  private handleAwareness(socket: Socket, joined: Set<string>, msg: CollabAwarenessPayload) {
    if (!msg || !validDocId(msg.docId) || !joined.has(msg.docId)) return;
    const bytes = toUint8Array(msg.update);
    if (!bytes) return;
    socket.to(msg.docId).emit(CollabServerEvents.Awareness, msg);
  }

  private schedulePersist(docId: string): void {
    if (!this.options.onPersist) return;
    const existing = this.persistTimers.get(docId);
    if (existing) clearTimeout(existing);
    const throttle = this.options.persistThrottleMs;
    const delay =
      typeof throttle === 'number' && Number.isFinite(throttle) && throttle >= 0
        ? throttle
        : DEFAULT_PERSIST_THROTTLE_MS;
    const timer = setTimeout(() => {
      this.persistTimers.delete(docId);
      try {
        const result = this.options.onPersist?.(docId, Y.encodeStateAsUpdate(this.getDoc(docId)));
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((error: unknown) => {
            console.error(`[collab] persist failed for doc=${docId}:`, error);
          });
        }
      } catch (error) {
        console.error(`[collab] persist failed for doc=${docId}:`, error);
      }
    }, delay);
    // Never hold the process open for a background persist.
    (timer as unknown as { unref?: () => void }).unref?.();
    this.persistTimers.set(docId, timer);
  }
}
