import { afterEach, describe, expect, it } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CollabClientEvents,
  CollabServerEvents,
  CollabPresence,
  SocketIOCollabProvider,
  useInkioCollaborativeEditor,
} from '../index';

const BASE = [Document, Paragraph, Text];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

async function startRelay() {
  const httpServer = createServer();
  const server = new Server(httpServer, { cors: { origin: '*' } });
  const docs = new Map<string, Y.Doc>();
  server.on('connection', (socket) => {
    socket.on(CollabClientEvents.Join, (payload: { docId: string }) => {
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
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  servers.push(server);
  return port;
}

describe('useInkioCollaborativeEditor', () => {
  it('seeds initialContent exactly once for a shared doc', async () => {
    const port = await startRelay();
    const doc = new Y.Doc();
    const url = `http://127.0.0.1:${port}`;
    const options = {
      docId: 'hook-doc',
      doc,
      extensions: BASE,
      initialContent: '<p>seed</p>',
    };
    const first = renderHook(() =>
      useInkioCollaborativeEditor({ ...options, socket: io(url, { autoConnect: false }) }),
    );
    await waitFor(() => {
      expect(first.result.current.editor?.getHTML()).toBe('<p>seed</p>');
    });
    const second = renderHook(() =>
      useInkioCollaborativeEditor({ ...options, socket: io(url, { autoConnect: false }) }),
    );
    await waitFor(() => {
      expect(second.result.current.editor?.getHTML()).toBe('<p>seed</p>');
    });
    expect(first.result.current.editor?.getHTML()).toBe('<p>seed</p>');
    first.unmount();
    second.unmount();
  });
});

describe('CollabPresence', () => {
  it('renders nothing without peers and lists remote users', () => {
    const socket = io('http://127.0.0.1:1', { autoConnect: false });
    const provider = new SocketIOCollabProvider({ docId: 'presence-doc', socket });
    try {
      const empty = render(<CollabPresence provider={provider} />);
      expect(empty.container.innerHTML).toBe('');
      empty.unmount();

      const remote = new Awareness(new Y.Doc());
      remote.setLocalStateField('user', { name: 'Ada', color: '#ff0000' });
      applyAwarenessUpdate(
        provider.awareness,
        encodeAwarenessUpdate(remote, [remote.clientID]),
        null,
      );
      const listed = render(<CollabPresence provider={provider} />);
      expect(listed.getByTitle('Ada')).toBeTruthy();

      const none = render(<CollabPresence provider={null} />);
      expect(none.container.innerHTML).toBe('');
    } finally {
      provider.destroy();
    }
  });
});
