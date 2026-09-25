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
}

const DEFAULT_PERSIST_THROTTLE_MS = 2000;

function toUint8Array(update: Uint8Array | ArrayBuffer): Uint8Array {
  return update instanceof Uint8Array ? update : new Uint8Array(update);
}

export class CollabSyncEngine {
  private readonly docs = new Map<string, Y.Doc>();
  private readonly persistTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly options: CollabEngineOptions = {}) {}

  get namespace(): string {
    return this.options.namespace ?? INKIO_COLLAB_NAMESPACE;
  }

  attach(server: Server): void {
    const nsp: Namespace = server.of(this.namespace);
    nsp.on('connection', (socket: Socket) => {
      socket.on(CollabClientEvents.Join, (payload: CollabJoinPayload) => {
        void this.handleJoin(socket, payload);
      });
    });
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

  private async handleJoin(socket: Socket, payload: CollabJoinPayload) {
    if (socket.data.collabJoined === payload.docId) return;
    const allowed = this.options.verify
      ? await this.options.verify(payload.token, payload.docId)
      : true;
    if (!allowed) {
      socket.emit(CollabServerEvents.Error, { docId: payload.docId, code: 'unauthorized' });
      return;
    }
    const doc = this.getDoc(payload.docId);
    socket.data.collabJoined = payload.docId;
    socket.join(payload.docId);
    socket.emit(CollabServerEvents.Init, {
      docId: payload.docId,
      update: Y.encodeStateAsUpdate(doc),
    });
    socket.on(CollabClientEvents.Update, (msg: CollabUpdatePayload) => {
      if (msg.docId !== payload.docId) return;
      Y.applyUpdate(doc, toUint8Array(msg.update));
      socket.to(msg.docId).emit(CollabServerEvents.Update, msg);
      this.schedulePersist(payload.docId);
    });
    socket.on(CollabClientEvents.Awareness, (msg: CollabAwarenessPayload) => {
      if (msg.docId !== payload.docId) return;
      socket.to(msg.docId).emit(CollabServerEvents.Awareness, msg);
    });
  }

  private schedulePersist(docId: string): void {
    if (!this.options.onPersist) return;
    const existing = this.persistTimers.get(docId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.persistTimers.delete(docId);
      void this.options.onPersist?.(docId, Y.encodeStateAsUpdate(this.getDoc(docId)));
    }, this.options.persistThrottleMs ?? DEFAULT_PERSIST_THROTTLE_MS);
    this.persistTimers.set(docId, timer);
  }
}
