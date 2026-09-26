import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  CollabClientEvents,
  CollabServerEvents,
  SocketIOCollabProvider,
  assertValidDocId,
} from '../index';

type Handler = (payload: never) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const fake = {
    handlers,
    emitted,
    connected: true,
    id: 'fake-socket',
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    emit: vi.fn((event: string, payload: unknown) => {
      emitted.push({ event, payload });
    }),
    disconnect: vi.fn(),
  };
  return fake;
}

function providerWithFakeSocket(options: Record<string, unknown> = {}) {
  const fake = createFakeSocket();
  const provider = new SocketIOCollabProvider({
    docId: 'room-1',
    socket: fake as never,
    ...(options as object),
  });
  return { provider, fake, emitted: fake.emitted };
}

describe('provider wire hardening', () => {
  it('rejects empty and oversized docIds', () => {
    expect(() => assertValidDocId('')).toThrow();
    expect(() => assertValidDocId('   ')).toThrow();
    expect(() => assertValidDocId('x'.repeat(257))).toThrow();
    expect(() => assertValidDocId('room-1')).not.toThrow();
    expect(
      () => new SocketIOCollabProvider({ docId: '', socket: createFakeSocket() as never }),
    ).toThrow();
  });

  it('drops malformed update frames instead of throwing', () => {
    const { provider, fake } = providerWithFakeSocket();
    const update = fake.handlers.get(CollabServerEvents.Update)!;
    expect(update).toBeDefined();
    expect(() =>
      update({ docId: 'room-1', update: 'not-binary' } as never),
    ).not.toThrow();
    expect(() => update({ docId: 'room-1' } as never)).not.toThrow();
    expect(() => update(undefined as never)).not.toThrow();
    expect(Y.encodeStateAsUpdate(provider.doc).length).toBeGreaterThan(0);
    provider.destroy();
  });

  it('surfaces token rejection as disconnected status', async () => {
    const { provider } = providerWithFakeSocket({
      token: async () => {
        throw new Error('auth down');
      },
    });
    const statuses: string[] = [];
    provider.onStatus((status) => {
      statuses.push(status);
    });
    await provider.connect();
    expect(provider.getStatus()).toBe('disconnected');
    expect(statuses).toContain('disconnected');
    provider.destroy();
  });

  it('maps forbidden errors to a distinct status', () => {
    const { provider, fake } = providerWithFakeSocket();
    const error = fake.handlers.get(CollabServerEvents.Error)!;
    error({ docId: 'room-1', code: 'forbidden' } as never);
    expect(provider.getStatus()).toBe('forbidden');
    // Rejection survives a socket drop instead of flapping.
    fake.handlers.get('disconnect')!({} as never);
    expect(provider.getStatus()).toBe('forbidden');
    error({ docId: 'room-1', code: 'unauthorized' } as never);
    expect(provider.getStatus()).toBe('unauthorized');
    provider.destroy();
  });

  it('emits join with a static token', async () => {
    const { provider, emitted } = providerWithFakeSocket({ token: 'abc' });
    await provider.connect();
    expect(emitted).toContainEqual({
      event: CollabClientEvents.Join,
      payload: { docId: 'room-1', token: 'abc' },
    });
    provider.destroy();
  });

  it('sends an explicitly empty token instead of eliding it', async () => {
    const { provider, emitted } = providerWithFakeSocket({ token: '' });
    await provider.connect();
    expect(emitted).toContainEqual({
      event: CollabClientEvents.Join,
      payload: { docId: 'room-1', token: '' },
    });
    provider.destroy();
  });

  it('replays pre-init updates after init instead of dropping them', () => {
    const { provider, fake, emitted } = providerWithFakeSocket();
    try {
      // A peer broadcast arriving between our Join and our Init: drive the
      // server-to-client handler directly (fake.emit records client sends).
      const peerDoc = new Y.Doc();
      peerDoc.getText('t').insert(0, 'peer');
      const onUpdate = fake.handlers.get(CollabServerEvents.Update)!;
      onUpdate({ docId: 'room-1', update: Y.encodeStateAsUpdate(peerDoc) } as never);
      expect(provider.doc.getText('t').toString()).toBe('');
      const init = fake.handlers.get(CollabServerEvents.Init)!;
      init({ docId: 'room-1', update: Y.encodeStateAsUpdate(new Y.Doc()) } as never);
      expect(provider.doc.getText('t').toString()).toBe('peer');
      expect(emitted.filter((e) => e.event === CollabClientEvents.Update).length).toBe(1);
    } finally {
      provider.destroy();
    }
  });

  it('resyncs offline doc updates and local awareness on init', () => {
    const { provider, fake, emitted } = providerWithFakeSocket();
    try {
      // Offline local edit + presence before the server snapshot arrives.
      provider.doc.getText('t').insert(0, 'offline');
      provider.awareness.setLocalStateField('user', { name: 'B', color: '#000' });
      const init = fake.handlers.get(CollabServerEvents.Init)!;
      init({ docId: 'room-1', update: Y.encodeStateAsUpdate(new Y.Doc()) } as never);
      const updates = emitted.filter((e) => e.event === CollabClientEvents.Update);
      const presence = emitted.filter((e) => e.event === CollabClientEvents.Awareness);
      expect(updates).toHaveLength(1);
      expect(presence).toHaveLength(1);
      const merged = new Y.Doc();
      Y.applyUpdate(merged, (updates[0].payload as { update: Uint8Array }).update);
      expect(merged.getText('t').toString()).toBe('offline');
    } finally {
      provider.destroy();
    }
  });
});
