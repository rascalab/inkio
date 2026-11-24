import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Content, JSONContent } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import type { HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { mergeExtensions, resolveInkioExtensions, useCoalescedDocUpdate, useStableCallback, useStableExtensions, withDocumentAccess, type ExtensionsInput, type InkioEditor, type RegisteredEditor, type WithEditorExtensions } from '@inkio/core';
import { COLLAB_CONFLICTING_EXTENSIONS, createCollabExtensions, removeConflictingExtensions } from './extensions';
import { getCollabCacheKey, persistDocToIndexedDB, type CollabCacheScope } from './persistence';
import { FALLBACK_PRESENCE_USER, normalizePresenceUser } from './presence-user';
import {
  createCollabProvider,
  getCollabStatus,
  isReadOnly,
  onCollabStatus,
  retryCollabAuthentication,
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
  /** Opt in to an IndexedDB cache isolated by account and deployment. */
  offline?: false | CollabCacheScope;
}

/**
 * Creates the provider inside an effect (StrictMode-safe: the dev double
 * mount destroys and rebuilds it cleanly). Returns null during SSR and the
 * first client render.
 */
export function useCollabProvider(options: UseCollabProviderOptions): CollabProvider | null {
  const { docId, url, websocketProvider, doc, token, user, offline } = options;
  const accountId = offline ? offline.accountId : undefined;
  const deploymentId = offline ? offline.deploymentId : undefined;
  if (offline) getCollabCacheKey(docId, offline);
  const session = useMemo(
    () => ({ docId, url, websocketProvider, doc, accountId, deploymentId }),
    [docId, url, websocketProvider, doc, accountId, deploymentId],
  );
  const [active, setActive] = useState<{ session: typeof session; provider: CollabProvider } | null>(null);
  const provider = active?.session === session ? active.provider : null;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const document = session.doc ?? new Y.Doc();
    const { accountId, deploymentId } = session;
    let attemptedToken: CollabToken | undefined;
    const next = createCollabProvider({
      docId: session.docId,
      url: session.url,
      websocketProvider: session.websocketProvider,
      doc: document,
      token: () => {
        const current = tokenRef.current;
        attemptedToken = current;
        return typeof current === 'function' ? current() : current;
      },
      user: userRef.current,
    });
    next.on('authenticationFailed', () => {
      // A rotated token may have arrived before the old handshake was rejected.
      if (typeof tokenRef.current === 'string' && tokenRef.current !== attemptedToken) {
        retryCollabAuthentication(next);
      }
    });
    const offlineStore = accountId && deploymentId && typeof indexedDB !== 'undefined'
      ? persistDocToIndexedDB(session.docId, document, { accountId, deploymentId })
      : null;
    setActive({ session, provider: next });
    return () => {
      next.destroy();
      void offlineStore?.destroy().catch(() => {});
      if (!session.doc) document.destroy();
    };
  }, [session]);

  const staticToken = typeof token === 'string' ? token : undefined;
  useEffect(() => {
    if (provider) retryCollabAuthentication(provider);
  }, [provider, staticToken]);

  useEffect(() => {
    provider?.setAwarenessField('user', normalizePresenceUser(user) ?? FALLBACK_PRESENCE_USER);
  }, [provider, user?.name, user?.color]);

  return provider;
}

const disconnected = (): CollabStatus => 'disconnected';

export function useCollabStatus(provider: CollabProvider | null): CollabStatus {
  const subscribe = useCallback(
    (notify: () => void) => provider ? onCollabStatus(provider, notify) : () => {},
    [provider],
  );
  const snapshot = useCallback((): CollabStatus => provider ? getCollabStatus(provider) : 'disconnected', [provider]);
  return useSyncExternalStore(subscribe, snapshot, disconnected);
}

export interface CollabPeer {
  clientId: number;
  user?: CollabUser;
}

export function useCollabPeers(provider: CollabProvider | null): CollabPeer[] {
  const [presence, setPresence] = useState<{ provider: CollabProvider; peers: CollabPeer[] } | null>(null);
  useEffect(() => {
    const awareness = provider?.awareness;
    if (!provider || !awareness) return;
    const read = () => {
      const next: CollabPeer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== awareness.clientID) {
          next.push({ clientId, user: normalizePresenceUser(state?.user) });
        }
      });
      setPresence({ provider, peers: next });
    };
    read();
    awareness.on('change', read);
    return () => {
      awareness.off('change', read);
    };
  }, [provider]);
  return presence && presence.provider === provider ? presence.peers : [];
}

export interface UseInkioCollaborativeEditorOptions extends UseCollabProviderOptions {
  extensions?: ExtensionsInput;
  /**
   * Seed for an empty shared doc. Seeding is deterministic, so every client
   * may pass the same seed: concurrent joiners converge on one copy.
   */
  content?: Content;
  editable?: boolean;
  ariaLabel?: string;
  onChange?: (editor: InkioEditor) => void;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: InkioEditor) => void;
}

export interface CollaborativeEditor<Instance extends InkioEditor = InkioEditor> {
  editor: Instance | null;
  provider: CollabProvider | null;
  status: CollabStatus;
  /** True when the server granted a read-only scope. */
  readOnly: boolean;
}

type ReservedExtension = typeof COLLAB_CONFLICTING_EXTENSIONS[number] | 'collaboration' | 'collaborationCaret';

export function useInkioCollaborativeEditor<const Input extends UseInkioCollaborativeEditorOptions['extensions']>(
  options: WithEditorExtensions<UseInkioCollaborativeEditorOptions, Input, ReservedExtension>,
): CollaborativeEditor<RegisteredEditor<Input, ReservedExtension>>;
export function useInkioCollaborativeEditor(options: UseInkioCollaborativeEditorOptions): CollaborativeEditor;
export function useInkioCollaborativeEditor({
  extensions,
  content: seedContent,
  editable = true,
  ariaLabel = 'Rich text editor',
  onChange,
  onUpdate,
  onCreate,
  ...providerOptions
}: UseInkioCollaborativeEditorOptions): CollaborativeEditor {
  const provider = useCollabProvider(providerOptions);
  const status = useCollabStatus(provider);
  const readOnly = provider ? isReadOnly(provider) : false;
  const lastWritableSync = useRef<CollabProvider | null>(null);
  useEffect(() => {
    if (status === 'synced') lastWritableSync.current = readOnly ? null : provider;
    else if (status === 'unauthorized') lastWritableSync.current = null;
  }, [provider, readOnly, status]);
  const canEdit = !!provider && editable && !readOnly && status !== 'unauthorized' && (
    status === 'synced' || (!!providerOptions.offline && lastWritableSync.current === provider)
  );
  const handleCreate = useStableCallback(onCreate);
  // Remote Yjs frames fire onUpdate too: serialize the doc at most once per
  // microtask burst, and not at all without a listener.
  const emitUpdate = useCoalescedDocUpdate(onUpdate, onChange);

  const stableExtensions = useStableExtensions(extensions);
  const base = useMemo(() => removeConflictingExtensions(resolveInkioExtensions(stableExtensions)), [stableExtensions]);

  const finalExtensions = useMemo(() => {
    if (!provider) return base;
    return mergeExtensions(base, createCollabExtensions({ document: provider.document, provider, user: providerOptions.user }));
    // The user is applied live through awareness; only the provider rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, provider]);
  const selection = useMemo(() => ({ bookmark: null as SelectionBookmark | null }), [provider]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: finalExtensions,
      editable: canEdit,
      editorProps: { attributes: {
        class: 'inkio-content',
        role: 'textbox',
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
      } },
      onBeforeCreate: ({ editor: instance }) => {
        if (!provider) return;
        // Bind the outgoing selection to its own session, never to a new room.
        instance.once('destroy', () => { selection.bookmark = instance.state.selection.getBookmark(); });
      },
      onMount: ({ editor: instance }) => {
        const bookmark = selection.bookmark;
        selection.bookmark = null;
        if (!bookmark) return;
        const { doc, tr } = instance.state;
        try {
          tr.setSelection(bookmark.resolve(doc));
        } catch {
          return; // The new schema no longer has that position.
        }
        instance.view.dispatch(tr.setMeta('addToHistory', false));
      },
      onCreate: ({ editor: instance }) => {
        if (provider && instance.options.extensions === finalExtensions && getCollabStatus(provider) !== 'unauthorized') {
          handleCreate?.(withDocumentAccess(instance));
        }
      },
      // setEditable emits 'update' with an empty transaction: only document
      // changes (local or remote) reach onUpdate (see core useInkioEditor).
      onUpdate: ({ editor: instance, transaction, appendedTransactions }) => {
        if (!transaction.docChanged && !appendedTransactions.some((tr) => tr.docChanged)) return;
        if (provider && instance.options.extensions === finalExtensions && getCollabStatus(provider) !== 'unauthorized') emitUpdate(instance);
      },
    },
    [finalExtensions],
  );

  // useEditor swaps instances in an effect. The registration identity covers
  // both the session/provider and the requested extensions, even in the same room.
  const currentEditor = provider && status !== 'unauthorized' && editor?.options.extensions === finalExtensions && !editor.isDestroyed
    ? withDocumentAccess(editor) : null;
  useEffect(() => {
    if (currentEditor && !currentEditor.isDestroyed && currentEditor.options.editable !== canEdit) currentEditor.setEditable(canEdit);
  }, [currentEditor, canEdit]);

  useEffect(() => {
    if (!provider || !currentEditor || currentEditor.isDestroyed || status !== 'synced') return;
    if (seedContent === undefined || readOnly) return;
    seedYDoc(provider.document, currentEditor.schema, seedContent);
    // Seed once per synced session; later seed prop changes are ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, currentEditor, status, readOnly]);

  return { editor: currentEditor, provider, status, readOnly };
}
