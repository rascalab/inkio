import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor as TiptapEditor, Extensions, JSONContent } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import type { Socket } from 'socket.io-client';
import { getExtensions } from '@inkio/core';
import { createCollabExtensions, removeConflictingExtensions } from './extensions';
import { isYDocEmpty } from './ydoc';
import {
  SocketIOCollabProvider,
  type CollabProvider,
  type CollabStatus,
  type CollabUser,
} from './provider';

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function useYDoc(docId: string, doc?: Y.Doc): Y.Doc {
  const owned = useMemo(() => doc ?? new Y.Doc(), [docId, doc]);
  useEffect(() => {
    return () => {
      if (!doc) owned.destroy();
    };
  }, [owned, doc]);
  return owned;
}

export interface UseCollabProviderOptions {
  docId: string;
  doc?: Y.Doc;
  socket?: Socket;
  url?: string;
  socketOptions?: ConstructorParameters<typeof SocketIOCollabProvider>[0]['socketOptions'];
  token?: string | (() => string | undefined | Promise<string | undefined>);
  user?: CollabUser;
}

export function useCollabProvider(options: UseCollabProviderOptions): CollabProvider | null {
  const { docId, doc, user } = options;
  const ydoc = useYDoc(docId, doc);
  const initial = useRef(options);

  const provider = useMemo(() => {
    if (!isBrowser()) return null;
    const first = initial.current;
    return new SocketIOCollabProvider({
      docId,
      doc: ydoc,
      ...(first.socket ? { socket: first.socket } : {}),
      ...(first.url ? { url: first.url } : {}),
      ...(first.socketOptions ? { socketOptions: first.socketOptions } : {}),
      ...(first.token !== undefined ? { token: first.token } : {}),
      ...(first.user ? { user: first.user } : {}),
    });
  }, [docId, ydoc]);

  useEffect(() => {
    if (!provider) return;
    provider.connect();
    return () => {
      provider.destroy();
    };
  }, [provider]);

  useEffect(() => {
    if (provider && user) {
      provider.setUser(user);
    }
  }, [provider, user?.name, user?.color]);

  return provider;
}

export function useCollabStatus(provider: CollabProvider | null): CollabStatus {
  const [status, setStatus] = useState<CollabStatus>(() => provider?.getStatus() ?? 'disconnected');
  useEffect(() => {
    if (!provider) {
      setStatus('disconnected');
      return;
    }
    setStatus(provider.getStatus());
    return provider.onStatus(setStatus);
  }, [provider]);
  return status;
}

export interface CollabPeer {
  clientId: number;
  user?: CollabUser;
}

export function useCollabPeers(provider: CollabProvider | null): CollabPeer[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!provider) return;
    const awareness = provider.awareness;
    const rerender = () => forceRender((n) => n + 1);
    awareness.on('change', rerender);
    return () => {
      awareness.off('change', rerender);
    };
  }, [provider]);
  if (!provider) return [];
  const peers: CollabPeer[] = [];
  provider.awareness.getStates().forEach((state, clientId) => {
    if (clientId === provider.awareness.clientID) return;
    peers.push({ clientId, user: (state as { user?: CollabUser }).user });
  });
  return peers;
}

export interface UseInkioCollaborativeEditorOptions extends UseCollabProviderOptions {
  extensions?: Extensions;
  initialContent?: string | JSONContent;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
}

export interface CollaborativeEditor {
  editor: TiptapEditor | null;
  provider: CollabProvider | null;
  doc: Y.Doc;
  status: CollabStatus;
}

export function useInkioCollaborativeEditor({
  docId,
  doc,
  socket,
  url,
  socketOptions,
  token,
  user,
  extensions,
  initialContent,
  editable = true,
  onUpdate,
  onCreate,
}: UseInkioCollaborativeEditorOptions): CollaborativeEditor {
  const ydoc = useYDoc(docId, doc);
  const provider = useCollabProvider({ docId, doc: ydoc, socket, url, socketOptions, token, user });
  const status = useCollabStatus(provider);
  const wasEmptyAtConnect = useMemo(() => isYDocEmpty(ydoc), [docId]);
  const seededRef = useRef(false);

  const finalExtensions = useMemo(() => {
    const base = extensions && extensions.length > 0 ? extensions : (getExtensions() as Extensions);
    const withoutHistory = removeConflictingExtensions(base);
    if (!provider) return withoutHistory;
    return [...withoutHistory, ...createCollabExtensions({ document: ydoc })];
  }, [extensions, provider, ydoc]);

  const onCreateRef = useRef(onCreate);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onCreateRef.current = onCreate;
  }, [onCreate]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: finalExtensions,
      editable,
      editorProps: {
        attributes: {
          class: 'inkio-content',
        },
      },
      onCreate: ({ editor: editorInstance }) => {
        onCreateRef.current?.(editorInstance);
      },
      onUpdate: ({ editor: editorInstance }) => {
        onUpdateRef.current?.(editorInstance.getJSON());
      },
    },
    [finalExtensions],
  );

  useEffect(() => {
    if (!provider || !editor || editor.isDestroyed) return;
    if (status !== 'synced' || seededRef.current) return;
    seededRef.current = true;
    if (wasEmptyAtConnect && isYDocEmpty(ydoc) && initialContent !== undefined) {
      editor.commands.setContent(initialContent);
    }
  }, [provider, editor, status, wasEmptyAtConnect, ydoc, initialContent]);

  return { editor, provider, doc: ydoc, status };
}
