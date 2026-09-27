// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import {
  HocuspocusProviderWebsocket,
  createCollabProvider,
  createSeedUpdate,
  getCollabStatus,
  isReadOnly,
  onCollabStatus,
  seedYDoc,
  type CollabProvider,
} from '../index';
import { onCleanup, sleep, startServer, until } from './helpers';

const schema = getSchema([Document, Paragraph, Text]);
const para = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

function connect(url: string, docId: string, extra: Parameters<typeof createCollabProvider>[0] extends infer O ? Partial<O> : never = {}) {
  const provider = createCollabProvider({ docId, url, ...extra });
  onCleanup(() => provider.destroy());
  return provider;
}

const synced = (provider: CollabProvider) => until(() => getCollabStatus(provider) === 'synced');
const peerNames = (provider: CollabProvider) =>
  [...provider.awareness!.getStates().entries()]
    .filter(([id]) => id !== provider.awareness!.clientID)
    .map(([, state]) => (state as { user?: { name: string } }).user?.name);

describe('createCollabProvider', () => {
  it('converges text between two clients', async () => {
    const { url } = await startServer();
    const a = connect(url, 'converge');
    const b = connect(url, 'converge');
    await Promise.all([synced(a), synced(b)]);
    a.document.getText('t').insert(0, 'hello');
    await until(() => b.document.getText('t').toString() === 'hello');
  });

  it('shows existing peers to a late joiner immediately', async () => {
    const { url } = await startServer();
    const a = connect(url, 'late', { user: { name: 'A', color: '#f00' } });
    await synced(a);
    await sleep(100);
    const b = connect(url, 'late', { user: { name: 'B', color: '#0f0' } });
    await synced(b);
    await until(() => peerNames(b).includes('A'), 1000);
    await until(() => peerNames(a).includes('B'), 1000);
  });

  it('drops a peer from presence as soon as it leaves', async () => {
    const { url } = await startServer();
    const a = connect(url, 'leave', { user: { name: 'A', color: '#f00' } });
    const b = connect(url, 'leave', { user: { name: 'B', color: '#0f0' } });
    await Promise.all([synced(a), synced(b)]);
    await until(() => peerNames(b).includes('A'));
    a.destroy();
    await until(() => !peerNames(b).includes('A'), 1000);
  });

  it('resyncs edits made while disconnected', async () => {
    const { url } = await startServer();
    const a = connect(url, 'offline');
    const b = connect(url, 'offline');
    await Promise.all([synced(a), synced(b)]);
    a.disconnect();
    await until(() => getCollabStatus(a) === 'disconnected');
    a.document.getText('t').insert(0, 'offline edit');
    await a.connect();
    await until(() => b.document.getText('t').toString() === 'offline edit');
  });

  it('reports unauthorized when the server rejects the token', async () => {
    const { url } = await startServer({
      async onAuthenticate({ token }) {
        if (token !== 'good') throw new Error('nope');
      },
    });
    const bad = connect(url, 'auth', { token: 'bad' });
    await until(() => getCollabStatus(bad) === 'unauthorized');
    const good = connect(url, 'auth', { token: async () => 'good' });
    await synced(good);
  });

  it('notifies status transitions', async () => {
    const { url } = await startServer();
    const provider = connect(url, 'status');
    const seen: string[] = [];
    onCollabStatus(provider, (status) => seen.push(status));
    await synced(provider);
    expect(seen[seen.length - 1]).toBe('synced');
  });

  it('enforces a read-only scope on the server', async () => {
    const { url } = await startServer({
      async onAuthenticate({ token, connectionConfig }) {
        if (token === 'reader') connectionConfig.readOnly = true;
      },
    });
    const writer = connect(url, 'ro', { token: 'writer' });
    const reader = connect(url, 'ro', { token: 'reader' });
    await Promise.all([synced(writer), synced(reader)]);
    await until(() => isReadOnly(reader));
    expect(isReadOnly(writer)).toBe(false);
    reader.document.getText('t').insert(0, 'sneaky');
    writer.document.getText('t').insert(0, 'legit');
    await until(() => reader.document.getText('t').toString().includes('legit'));
    await sleep(200);
    expect(writer.document.getText('t').toString()).toBe('legit');
  });

  it('shares one socket across documents', async () => {
    const { url } = await startServer();
    const socket = new HocuspocusProviderWebsocket({ url });
    onCleanup(() => socket.destroy());
    const one = connect(url, 'multi-1', { websocketProvider: socket });
    const two = connect(url, 'multi-2', { websocketProvider: socket });
    await Promise.all([synced(one), synced(two)]);
  });

  it('rejects invalid ids and missing transport', () => {
    expect(() => createCollabProvider({ docId: ' ', url: 'ws://x' })).toThrow(/docId/);
    expect(() => createCollabProvider({ docId: 'x' })).toThrow(/url/);
  });
});

describe('seeding', () => {
  it('produces identical updates so concurrent seeds merge into one copy', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    expect(seedYDoc(a, schema, para('seed'))).toBe(true);
    expect(seedYDoc(b, schema, para('seed'))).toBe(true);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(a.getXmlFragment('default').length).toBe(1);
    expect(a.getXmlFragment('default').toString()).toBe(b.getXmlFragment('default').toString());
  });

  it('skips a doc that already has content', () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, createSeedUpdate(schema, para('first')));
    expect(seedYDoc(doc, schema, para('second'))).toBe(false);
    expect(doc.getXmlFragment('default').toString()).toContain('first');
  });
});
