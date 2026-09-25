import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import * as Y from 'yjs';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import {
  CollabClientEvents,
  CollabServerEvents,
  SocketIOCollabProvider,
  createCollabExtensions,
  removeConflictingExtensions,
  type CollabStatus,
} from '../index';

const BASE = [Document, Paragraph, Text];

function waitStatus(provider: SocketIOCollabProvider, want: CollabStatus, timeoutMs = 3000) {
  if (provider.getStatus() === want) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`timed out waiting for status ${want}`));
    }, timeoutMs);
    const unsub = provider.onStatus((status) => {
      if (status === want) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

function waitEditorHtml(editor: Editor, html: string, timeoutMs = 3000) {
  if (editor.getHTML() === html) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      editor.off('update', check);
      reject(new Error(`timed out waiting for html ${html}, got ${editor.getHTML()}`));
    }, timeoutMs);
    const check = () => {
      if (editor.getHTML() === html) {
        clearTimeout(timer);
        editor.off('update', check);
        resolve();
      }
    };
    editor.on('update', check);
  });
}

interface RelayOptions {
  token?: string;
}

async function startRelay(options: RelayOptions = {}) {
  const httpServer = createServer();
  const server = new Server(httpServer, { cors: { origin: '*' } });
  const docs = new Map<string, Y.Doc>();
  server.on('connection', (socket) => {
    socket.on(CollabClientEvents.Join, (payload: { docId: string; token?: string }) => {
      if (options.token !== undefined && payload.token !== options.token) {
        socket.emit(CollabServerEvents.Error, { docId: payload.docId, code: 'unauthorized' });
        return;
      }
      let doc = docs.get(payload.docId);
      if (!doc) {
        doc = new Y.Doc();
        docs.set(payload.docId, doc);
      }
      socket.join(payload.docId);
      socket.emit(CollabServerEvents.Init, {
        docId: payload.docId,
        update: Y.encodeStateAsUpdate(doc),
      });
      socket.on(CollabClientEvents.Update, (msg: { docId: string; update: Uint8Array }) => {
        const target = docs.get(msg.docId);
        if (!target) return;
        Y.applyUpdate(target, msg.update);
        socket.to(msg.docId).emit(CollabServerEvents.Update, msg);
      });
      socket.on(CollabClientEvents.Awareness, (msg: { docId: string; update: Uint8Array }) => {
        socket.to(msg.docId).emit(CollabServerEvents.Awareness, msg);
      });
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  return { server, port };
}

function connectProvider(docId: string, port: number, extra: { token?: string } = {}) {
  const socket: Socket = io(`http://127.0.0.1:${port}`, { autoConnect: false });
  const provider = new SocketIOCollabProvider({
    docId,
    socket,
    ...(extra.token !== undefined ? { token: extra.token } : {}),
  });
  provider.connect();
  return provider;
}

const editors: Editor[] = [];
const providers: SocketIOCollabProvider[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const editor of editors.splice(0)) editor.destroy();
  for (const provider of providers.splice(0)) provider.destroy();
  for (const server of servers.splice(0)) await server.close();
  vi.restoreAllMocks();
});

function trackProvider(provider: SocketIOCollabProvider) {
  providers.push(provider);
  return provider;
}

function makeEditor(doc: Y.Doc) {
  const editor = new Editor({
    extensions: [...BASE, ...createCollabExtensions({ document: doc })],
  });
  editors.push(editor);
  return editor;
}

describe('SocketIOCollabProvider relay', () => {
  it('converges two editors on the same doc', async () => {
    const { server, port } = await startRelay();
    servers.push(server);
    const providerA = trackProvider(connectProvider('doc-1', port));
    const providerB = trackProvider(connectProvider('doc-1', port));
    await Promise.all([waitStatus(providerA, 'synced'), waitStatus(providerB, 'synced')]);

    const editorA = makeEditor(providerA.doc);
    const editorB = makeEditor(providerB.doc);
    editorA.commands.setContent('<p>hello</p>');
    await waitEditorHtml(editorB, '<p>hello</p>');

    editorA.commands.setContent('<p>hello world</p>');
    await waitEditorHtml(editorB, '<p>hello world</p>');
    expect(editorB.getHTML()).toBe('<p>hello world</p>');
  });

  it('resyncs offline edits after reconnect', async () => {
    const { server, port } = await startRelay();
    servers.push(server);
    const providerA = trackProvider(connectProvider('doc-2', port));
    const providerB = trackProvider(connectProvider('doc-2', port));
    await Promise.all([waitStatus(providerA, 'synced'), waitStatus(providerB, 'synced')]);

    const editorA = makeEditor(providerA.doc);
    const editorB = makeEditor(providerB.doc);
    editorA.commands.setContent('<p>v1</p>');
    await waitEditorHtml(editorB, '<p>v1</p>');

    providerB.disconnect();
    editorA.commands.setContent('<p>v2</p>');
    expect(editorB.getHTML()).toBe('<p>v1</p>');

    providerB.connect();
    await waitStatus(providerB, 'synced');
    await waitEditorHtml(editorB, '<p>v2</p>');
  });

  it('rejects a wrong token as unauthorized without syncing', async () => {
    const { server, port } = await startRelay({ token: 'secret' });
    servers.push(server);
    const providerA = trackProvider(connectProvider('doc-3', port, { token: 'secret' }));
    const providerB = trackProvider(connectProvider('doc-3', port, { token: 'nope' }));
    await waitStatus(providerA, 'synced');
    await waitStatus(providerB, 'unauthorized');

    const editorA = makeEditor(providerA.doc);
    const editorB = makeEditor(providerB.doc);
    editorA.commands.setContent('<p>private</p>');
    expect(editorA.getHTML()).toBe('<p>private</p>');
    expect(editorB.getHTML()).not.toBe('<p>private</p>');
  });

  it('propagates awareness states between peers', async () => {
    const { server, port } = await startRelay();
    servers.push(server);
    const providerA = trackProvider(connectProvider('doc-4', port));
    const providerB = trackProvider(connectProvider('doc-4', port));
    await Promise.all([waitStatus(providerA, 'synced'), waitStatus(providerB, 'synced')]);

    providerA.setUser({ name: 'Ada', color: '#ff0000' });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('awareness did not arrive')), 3000);
      const check = () => {
        const states = [...providerB.awareness.getStates().values()] as { user?: { name: string } }[];
        if (states.some((s) => s.user?.name === 'Ada')) {
          clearTimeout(timer);
          providerB.awareness.off('change', check);
          resolve();
        }
      };
      providerB.awareness.on('change', check);
      check();
    });
  });
});

describe('extension helpers', () => {
  it('drops history and undoRedo extensions for collab mode', () => {
    const input = [{ name: 'history' }, { name: 'paragraph' }, { name: 'undoRedo' }];
    const output = removeConflictingExtensions(input as never);
    expect(output.map((ext) => (ext as { name: string }).name)).toEqual(['paragraph']);
  });

  it('creates exactly the Collaboration binding extension', () => {
    const doc = new Y.Doc();
    const extensions = createCollabExtensions({ document: doc });
    expect(extensions).toHaveLength(1);
    expect((extensions[0] as { name: string }).name).toBe('collaboration');
  });
});
