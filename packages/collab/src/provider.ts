import {
  HocuspocusProvider,
  WebSocketStatus,
  type HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import * as Y from 'yjs';
import { assertValidDocId } from './doc-id';

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

const rejected = new WeakMap<CollabProvider, boolean>();

async function resolveToken(token: CollabToken | undefined): Promise<string> {
  const value = typeof token === 'function' ? await token() : token;
  return value ?? '';
}

export function createCollabProvider(options: CreateCollabProviderOptions): CollabProvider {
  const { docId, url, websocketProvider, doc, token, user } = options;
  assertValidDocId(docId);
  if (!url && !websocketProvider) {
    throw new Error('[inkio/collab] pass either `url` or `websocketProvider`.');
  }
  const provider = new HocuspocusProvider({
    name: docId,
    document: doc ?? new Y.Doc(),
    token: () => resolveToken(token),
    ...(websocketProvider ? { websocketProvider } : { url: url as string }),
  });
  provider.on('authenticationFailed', () => rejected.set(provider, true));
  provider.on('authenticated', () => rejected.set(provider, false));
  // A caller-owned socket is not attached automatically.
  if (websocketProvider) provider.attach();
  if (user) provider.setAwarenessField('user', user);
  return provider;
}

export function getCollabStatus(provider: CollabProvider): CollabStatus {
  if (rejected.get(provider)) return 'unauthorized';
  const socketStatus = provider.configuration.websocketProvider.status;
  if (socketStatus === WebSocketStatus.Disconnected) return 'disconnected';
  if (socketStatus === WebSocketStatus.Connected && provider.isSynced) return 'synced';
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
  const events = ['status', 'synced', 'authenticated', 'authenticationFailed', 'destroy'];
  for (const event of events) provider.on(event, check);
  return () => {
    for (const event of events) provider.off(event, check);
  };
}

export function isReadOnly(provider: CollabProvider): boolean {
  return provider.authorizedScope === 'readonly';
}
