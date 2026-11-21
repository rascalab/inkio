import {
  HocuspocusProvider,
  WebSocketStatus,
  type HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import * as Y from 'yjs';
import { assertValidDocId } from './doc-id';
import { normalizePresenceUser } from './presence-user';

export interface CollabUser {
  name: string;
  color: string;
}

export type CollabProvider = HocuspocusProvider;

export type CollabStatus = 'connecting' | 'synced' | 'disconnected' | 'unauthorized';

export type CollabStatusListener = (status: CollabStatus) => void;

export type CollabToken = string | (() => string | undefined | Promise<string | undefined>);

export interface CreateCollabProviderOptions {
  docId: string;
  /** Hocuspocus server URL (`ws://` / `wss://`). Ignored when `websocketProvider` is given. */
  url?: string;
  /** Share one socket across several documents. */
  websocketProvider?: HocuspocusProviderWebsocket;
  doc?: Y.Doc;
  /** Resolved on every (re)connect, so a function can return a fresh token. */
  token?: CollabToken;
  user?: CollabUser;
}

const ACCESS_DENIED = 'inkio:access-denied';
const sessions = new WeakMap<CollabProvider, { rejected: boolean; retry: () => void }>();

/** Retry one document after refreshing credentials, without resetting its shared socket. */
export function retryCollabAuthentication(provider: CollabProvider): void {
  sessions.get(provider)?.retry();
}

async function resolveToken(token: CollabToken | undefined): Promise<string> {
  const value = typeof token === 'function' ? await token() : token;
  return value ?? '';
}

class AuthenticatedProvider extends HocuspocusProvider {
  override startSync(): void {
    // The default onOpen starts sync even if a local token supplier throws.
    // Wait for auth so repeated local failures do not queue document frames.
    if (this.isAuthenticated) super.startSync();
  }
}

export function createCollabProvider(options: CreateCollabProviderOptions): CollabProvider {
  const { docId, url, websocketProvider, doc, token, user } = options;
  assertValidDocId(docId);
  if (!url && !websocketProvider) {
    throw new Error('[inkio/collab] pass either `url` or `websocketProvider`.');
  }
  const provider = new AuthenticatedProvider({
    name: docId,
    document: doc ?? new Y.Doc(),
    token: () => resolveToken(token),
    ...(websocketProvider ? { websocketProvider, sessionAwareness: true } : { url: url as string }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let destroyed = false;
  let retrying = false;
  const clearRetry = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const session = {
    rejected: false,
    retry() {
      clearRetry();
      if (destroyed || retrying || !session.rejected) return;
      const socket = provider.configuration.websocketProvider;
      if (socket.status === WebSocketStatus.Connected && socket.receivedOnOpenPayload) {
        // Hocuspocus clears a refused room's auth state on the server; only
        // redo this document's handshake, not its siblings on a shared socket.
        retrying = true;
        void provider.onOpen(socket.receivedOnOpenPayload);
      }
    },
  };
  sessions.set(provider, session);
  const scheduleRetry = () => {
    if (timer !== undefined) return;
    // Retry ambiguous failures (including document-load failures) with jitter.
    const delay = Math.min(1000 * 2 ** Math.min(failures++, 5), 30_000);
    timer = setTimeout(session.retry, delay * (0.75 + Math.random() * 0.25));
  };
  provider.on('authenticationFailed', ({ reason }: { reason: string }) => {
    retrying = false;
    session.rejected = true;
    provider.onClose();
    if (reason === ACCESS_DENIED) clearRetry();
    else scheduleRetry();
  });
  provider.on('close', () => {
    retrying = false;
    // The server can close a single room without closing its socket
    // (e.g. to revoke a grant). Require a fresh handshake for that room.
    if (provider.configuration.websocketProvider.status === WebSocketStatus.Connected) {
      session.rejected = true;
      scheduleRetry();
    }
  });
  provider.on('authenticated', () => {
    retrying = false;
    session.rejected = false;
    clearRetry();
    provider.startSync();
  });
  provider.on('synced', () => { failures = 0; });
  provider.on('open', clearRetry);
  provider.on('destroy', () => {
    destroyed = true;
    clearRetry();
  });
  // A caller-owned socket is not attached automatically.
  if (websocketProvider) provider.attach();
  if (user) provider.setAwarenessField('user', normalizePresenceUser(user));
  return provider;
}

export function getCollabStatus(provider: CollabProvider): CollabStatus {
  if (sessions.get(provider)?.rejected) return 'unauthorized';
  const socketStatus = provider.configuration.websocketProvider.status;
  if (socketStatus === WebSocketStatus.Disconnected) return 'disconnected';
  if (socketStatus === WebSocketStatus.Connected && provider.isAuthenticated && provider.isSynced) return 'synced';
  return 'connecting';
}

/** Calls `listener` whenever the derived status changes. Returns an unsubscribe. */
export function onCollabStatus(provider: CollabProvider, listener: CollabStatusListener): () => void {
  let last = getCollabStatus(provider);
  const check = () => {
    const next = getCollabStatus(provider);
    if (next === last) return;
    last = next;
    listener(next);
  };
  const events = ['status', 'synced', 'authenticated', 'authenticationFailed', 'close', 'destroy'];
  for (const event of events) provider.on(event, check);
  return () => {
    for (const event of events) provider.off(event, check);
  };
}

export function isReadOnly(provider: CollabProvider): boolean {
  return provider.authorizedScope === 'readonly';
}
