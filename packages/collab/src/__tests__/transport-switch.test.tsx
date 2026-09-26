import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as Y from 'yjs';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CollabClientEvents,
  CollabServerEvents,
  useCollabProvider,
} from '../index';

const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

async function startCountingRelay() {
  const httpServer = createServer();
  const server = new Server(httpServer, { cors: { origin: '*' } });
  const joins: string[] = [];
  server.on('connection', (socket) => {
    socket.on(CollabClientEvents.Join, (payload: { docId: string }) => {
      joins.push(payload.docId);
      socket.join(payload.docId);
      socket.emit(CollabServerEvents.Init, {
        docId: payload.docId,
        update: Y.encodeStateAsUpdate(new Y.Doc()),
      });
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  servers.push(server);
  return { url: `http://127.0.0.1:${port}`, joins };
}

describe('useCollabProvider transport switch', () => {
  it('dials the new relay when url changes', async () => {
    const first = await startCountingRelay();
    const second = await startCountingRelay();
    const { result, rerender, unmount } = renderHook(({ url }) => useCollabProvider({ docId: 'switch-doc', url }), {
      initialProps: { url: first.url },
    });
    await waitFor(() => {
      expect(first.joins).toContain('switch-doc');
    });
    rerender({ url: second.url });
    await waitFor(() => {
      expect(second.joins).toContain('switch-doc');
    });
    expect(result.current?.docId).toBe('switch-doc');
    unmount();
  });

  it('recreates the provider when a string token changes', async () => {
    const relay = await startCountingRelay();
    const { result, rerender, unmount } = renderHook(
      ({ token }) => useCollabProvider({ docId: 'token-doc', url: relay.url, token }),
      { initialProps: { token: 'token-one' } },
    );
    await waitFor(() => {
      expect(relay.joins).toContain('token-doc');
    });
    const before = result.current;
    const joinsBefore = relay.joins.length;
    rerender({ token: 'token-two' });
    await waitFor(() => {
      expect(result.current).not.toBe(before);
      expect(relay.joins.length).toBeGreaterThan(joinsBefore);
    });
    unmount();
  });
});
