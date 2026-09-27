import { useEffect, useMemo, useRef, useState } from 'react';
import type { Content, Editor as TiptapEditor, Extensions, JSONContent } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import type { HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { resolveInkioExtensions, useCoalescedDocUpdate, useStableCallback } from '@inkio/core';
import { createCollabExtensions, removeConflictingExtensions } from './extensions';
import { persistDocToIndexedDB } from './persistence';
import {
  createCollabProvider,
  getCollabStatus,
  isReadOnly,
  onCollabStatus,
  type CollabProvider,
  type CollabStatus,
  type CollabToken,
  type CollabUser,
} from './provider';
import { seedYDoc } from './seed';

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export interface UseCollabProviderOptions {
  docId: string;
  /** Hocuspocus server URL (`ws://` / `wss://`). */
  url?: string;
  /** Share one socket across several documents. */
  websocketProvider?: HocuspocusProviderWebsocket;
  /** Bring your own doc; otherwise one is created (and destroyed) per docId. */
  doc?: Y.Doc;
  /** Read on every (re)connect: rotating it never tears down the session. */
  token?: CollabToken;
  user?: CollabUser;
  /** Cache the doc in IndexedDB so edits survive reloads while offline. */
  offline?: boolean;
}

/**
 * Creates the provider inside an effect (StrictMode-safe: the dev double
 * mount destroys and rebuilds it cleanly). Returns null during SSR and the
 * first client render.
 */
export function useCollabProvider(options: UseCollabProviderOptions): CollabProvider | null {
  const { docId, url, websocketProvider, doc, token, user, offline = false } = options;
  const [provider, setProvider] = useState<CollabProvider | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const document = doc ?? new Y.Doc();
    const offlineStore = offline ? persistDocToIndexedDB(docId, document) : null;
    const next = createCollabProvider({
      docId,
      url,
      websocketProvider,
      doc: document,
      token: () => {
        const current = tokenRef.current;
        return typeof current === 'function' ? current() : current;
      },
      user: userRef.current,
    });
    setProvider(next);
    return () => {
      next.destroy();
      offlineStore?.destroy();
      if (!doc) document.destroy();
      setProvider(null);
    };
  }, [docId, url, websocketProvider, doc, offline]);

  useEffect(() => {
    if (provider && user) provider.setAwarenessField('user', user);
  }, [provider, user?.name, user?.color]);

  return provider;
}

export function useCollabStatus(provider: CollabProvider | null): CollabStatus {
  const [status, setStatus] = useState<CollabStatus>('disconnected');
  useEffect(() => {
    if (!provider) {
      setStatus('disconnected');
      return;
    }
    setStatus(getCollabStatus(provider));
    return onCollabStatus(provider, setStatus);
  }, [provider]);
  return status;
}

export interface CollabPeer {
  clientId: number;
  user?: CollabUser;
}

export function useCollabPeers(provider: CollabProvider | null): CollabPeer[] {
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      setPeers([]);
      return;
    }
    const read = () => {
      const next: CollabPeer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== awareness.clientID) {
          next.push({ clientId, user: (state as { user?: CollabUser }).user });
        }
      });
      setPeers(next);
    };
    read();
    awareness.on('change', read);
    return () => {
      awareness.off('change', read);
    };
  }, [provider]);
  return peers;
}

export interface UseInkioCollaborativeEditorOptions extends UseCollabProviderOptions {
  extensions?: Extensions;
  /**
   * Seed for an empty shared doc. Seeding is deterministic, so every client
   * may pass the same seed: concurrent joiners converge on one copy.
   */
  content?: Content;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
}

export interface CollaborativeEditor {
  editor: TiptapEditor | null;
  provider: CollabProvider | null;
  status: CollabStatus;
  /** True when the server granted a read-only scope. */
  readOnly: boolean;
}

export function useInkioCollaborativeEditor({
  extensions,
  content: seedContent,
  editable = true,
  onUpdate,
  onCreate,
  ...providerOptions
}: UseInkioCollaborativeEditorOptions): CollaborativeEditor {
  const provider = useCollabProvider(providerOptions);
  const status = useCollabStatus(provider);
  const [readOnly, setReadOnly] = useState(false);
  const handleCreate = useStableCallback(onCreate);
  // Remote Yjs frames fire onUpdate too: serialize the doc at most once per
  // microtask burst, and not at all without a listener.
  const emitUpdate = useCoalescedDocUpdate(onUpdate);

  useEffect(() => {
    if (!provider) return;
    const sync = () => setReadOnly(isReadOnly(provider));
    sync();
    provider.on('authenticated', sync);
    return () => {
      provider.off('authenticated', sync);
    };
  }, [provider]);

  const finalExtensions = useMemo(() => {
    const base = removeConflictingExtensions(resolveInkioExtensions(extensions));
    if (!provider) return base;
    return [
      ...base,
      ...createCollabExtensions({ document: provider.document, provider, user: providerOptions.user }),
    ];
    // The user is applied live through awareness; only the provider rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions, provider]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: finalExtensions,
      editable: editable && !readOnly,
      editorProps: { attributes: { class: 'inkio-content' } },
      onCreate: ({ editor: instance }) => handleCreate?.(instance),
      onUpdate: ({ editor: instance }) => emitUpdate(instance),
    },
    [finalExtensions],
  );

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(editable && !readOnly);
  }, [editor, editable, readOnly]);

  useEffect(() => {
    if (!provider || !editor || editor.isDestroyed || status !== 'synced') return;
    if (seedContent === undefined || readOnly) return;
    seedYDoc(provider.document, editor.schema, seedContent);
    // Seed once per synced session; later seed prop changes are ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, editor, status, readOnly]);

  return { editor, provider, status, readOnly };
}
