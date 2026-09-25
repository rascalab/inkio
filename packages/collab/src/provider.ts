import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import {
  CollabClientEvents,
  CollabServerEvents,
  type CollabAwarenessPayload,
  type CollabErrorPayload,
  type CollabInitPayload,
  type CollabUpdatePayload,
} from './protocol';
import { INKIO_REMOTE_ORIGIN, applyRemoteUpdate } from './ydoc';

export interface CollabUser {
  name: string;
  color: string;
}

export type CollabStatus = 'connecting' | 'synced' | 'disconnected' | 'unauthorized';

export type CollabStatusListener = (status: CollabStatus) => void;

export interface CollabProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly docId: string;
  getStatus(): CollabStatus;
  onStatus(listener: CollabStatusListener): () => void;
  setUser(user: CollabUser): void;
  connect(): void;
  disconnect(): void;
  destroy(): void;
}

export interface SocketIOCollabProviderOptions {
  docId: string;
  doc?: Y.Doc;
  socket?: Socket;
  url?: string;
  socketOptions?: Parameters<typeof io>[1];
  token?: string | (() => string | undefined | Promise<string | undefined>);
  user?: CollabUser;
}

/** Upper bound for a room id that is also used as an IDB name and log field. */
const MAX_DOC_ID_LENGTH = 256;

export function assertValidDocId(docId: string): void {
  if (typeof docId !== 'string' || docId.trim() === '') {
    throw new Error('SocketIOCollabProvider: `docId` must be a non-empty string.');
  }
  if (docId.length > MAX_DOC_ID_LENGTH) {
    throw new Error(
      `SocketIOCollabProvider: \`docId\` exceeds ${MAX_DOC_ID_LENGTH} characters.`,
    );
  }
}

/**
 * Wire-only shape check: network bytes must be binary. Anything else is a
 * buggy or hostile frame and is dropped before it can throw inside the
 * sync loop. (Size caps are server policy: Init legitimately carries full
 * snapshots.)
 */
function toUint8Array(update: unknown): Uint8Array | null {
  if (update instanceof Uint8Array) return update;
  if (update instanceof ArrayBuffer) return new Uint8Array(update);
  if (ArrayBuffer.isView(update)) {
    // Cross-realm typed arrays (vm isolation, iframes): `instanceof`
    // fails across realms but an indexed copy still succeeds.
    try {
      return Uint8Array.from(update as unknown as ArrayLike<number>);
    } catch {
      return null;
    }
  }
  if (Object.prototype.toString.call(update) === '[object ArrayBuffer]') {
    try {
      return new Uint8Array((update as ArrayBuffer).slice(0));
    } catch {
      return null;
    }
  }
  return null;
}

export class SocketIOCollabProvider implements CollabProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly docId: string;

  private socket: Socket;
  private ownsSocket: boolean;
  private token?: SocketIOCollabProviderOptions['token'];
  private status: CollabStatus = 'disconnected';
  private listeners = new Set<CollabStatusListener>();
  private joined = false;
  private wired = false;

  constructor(options: SocketIOCollabProviderOptions) {
    if (!options.socket && !options.url) {
      throw new Error('SocketIOCollabProvider: pass either `socket` or `url`.');
    }
    assertValidDocId(options.docId);
    this.docId = options.docId;
    this.doc = options.doc ?? new Y.Doc();
    this.awareness = new Awareness(this.doc);
    this.token = options.token;
    if (options.user) {
      this.awareness.setLocalStateField('user', options.user);
    }
    this.ownsSocket = !options.socket;
    this.socket = options.socket ?? io(options.url as string, options.socketOptions);
    this.wire();
  }

  getStatus(): CollabStatus {
    return this.status;
  }

  onStatus(listener: CollabStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setUser(user: CollabUser): void {
    this.awareness.setLocalStateField('user', user);
  }

  connect(): void {
    this.setStatus('connecting');
    if (this.socket.connected) {
      void this.join();
      return;
    }
    this.socket.connect();
  }

  disconnect(): void {
    this.joined = false;
    if (this.ownsSocket) {
      this.socket.disconnect();
    }
    this.setStatus('disconnected');
  }

  destroy(): void {
    this.joined = false;
    this.socket.off('connect', this.handleConnect);
    this.socket.off('disconnect', this.handleDisconnect);
    this.socket.off(CollabServerEvents.Init, this.handleInit);
    this.socket.off(CollabServerEvents.Update, this.handleUpdate);
    this.socket.off(CollabServerEvents.Awareness, this.handleAwareness);
    this.socket.off(CollabServerEvents.Error, this.handleError);
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    if (this.ownsSocket) {
      this.socket.disconnect();
    }
    this.awareness.destroy();
    // Notify before clearing: observers must see the final transition.
    this.setStatus('disconnected');
    this.listeners.clear();
  }

  private setStatus(status: CollabStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  private wire(): void {
    if (this.wired) return;
    this.wired = true;
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on(CollabServerEvents.Init, this.handleInit);
    this.socket.on(CollabServerEvents.Update, this.handleUpdate);
    this.socket.on(CollabServerEvents.Awareness, this.handleAwareness);
    this.socket.on(CollabServerEvents.Error, this.handleError);
    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
    if (this.socket.connected) {
      void this.join();
    } else {
      this.setStatus('connecting');
    }
  }

  private handleConnect = (): void => {
    void this.join();
  };

  private handleDisconnect = (): void => {
    this.joined = false;
    if (this.status !== 'unauthorized') {
      this.setStatus('disconnected');
    }
  };

  private async join(): Promise<void> {
    let token: string | undefined;
    try {
      token = typeof this.token === 'function' ? await this.token() : this.token;
    } catch {
      // A rejecting token function surfaces as a disconnected status, not
      // an unhandled rejection: both join() callers (connect/handleConnect)
      // intentionally void the promise.
      this.joined = false;
      this.setStatus('disconnected');
      return;
    }
    this.socket.emit(CollabClientEvents.Join, {
      docId: this.docId,
      ...(token ? { token } : {}),
    });
  }

  private applyWireUpdate(update: unknown): boolean {
    const bytes = toUint8Array(update);
    if (!bytes) return false;
    try {
      applyRemoteUpdate(this.doc, bytes);
      return true;
    } catch {
      return false;
    }
  }

  private handleInit = (payload: CollabInitPayload): void => {
    if (!payload || payload.docId !== this.docId) return;
    if (!this.applyWireUpdate(payload.update)) return;
    this.joined = true;
    this.setStatus('synced');
  };

  private handleUpdate = (payload: CollabUpdatePayload): void => {
    if (!payload || payload.docId !== this.docId || !this.joined) return;
    this.applyWireUpdate(payload.update);
  };

  private handleAwareness = (payload: CollabAwarenessPayload): void => {
    if (!payload || payload.docId !== this.docId || !this.joined) return;
    const bytes = toUint8Array(payload.update);
    if (!bytes) return;
    try {
      applyAwarenessUpdate(this.awareness, bytes, this);
    } catch {
      // Drop malformed presence frames; the next update resyncs.
    }
  };

  private handleError = (payload: CollabErrorPayload): void => {
    if (payload.docId !== this.docId) return;
    if (payload.code === 'unauthorized' || payload.code === 'forbidden') {
      this.joined = false;
      this.setStatus('unauthorized');
    }
  };

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === INKIO_REMOTE_ORIGIN || !this.joined) return;
    const payload = { docId: this.docId, update };
    this.socket.emit(CollabClientEvents.Update, payload);
  };

  private handleAwarenessUpdate = (
    changed: { added: number[]; updated: number[]; removed: number[] },
  ): void => {
    if (!this.joined) return;
    const changedClients = [...changed.added, ...changed.updated, ...changed.removed];
    if (changedClients.length === 0) return;
    // No local removeAwarenessStates here: applyAwarenessUpdate already
    // manages local state, and removing would re-fire this handler
    // (duplicate echo per leave) since the origin cannot be filtered.
    this.socket.emit(CollabClientEvents.Awareness, {
      docId: this.docId,
      update: encodeAwarenessUpdate(this.awareness, changedClients),
    });
  };
}
