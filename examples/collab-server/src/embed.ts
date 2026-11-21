import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { setTimeout as wait } from 'node:timers/promises';
import type { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer, type RawData } from 'ws';
import { MAX_FRAME_BYTES, MAX_SOCKETS } from './limits';

export const websocketOptions = {
  maxPayload: MAX_FRAME_BYTES,
  maxFragments: 128,
  maxBufferedChunks: 256,
  perMessageDeflate: false,
};

export function parseUpgradeUrl(request: IncomingMessage): URL | null {
  const target = request.url;
  if (!target?.startsWith('/') || target.startsWith('//') || target.includes('\\') ||
    target.includes('#') || target.length > 2048) return null;
  try {
    return new URL(`http://localhost${target}`);
  } catch {
    return null;
  }
}

export interface AttachHocuspocusOptions {
  /** Only upgrades on this path are taken; everything else is left alone. */
  path?: string;
}

function toFetchRequest(request: IncomingMessage, url: URL): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }
  return new Request(url, { headers });
}

function toBytes(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return data;
  return Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data);
}

/**
 * Serve a Hocuspocus instance on an HTTP server someone else owns (NestJS,
 * Express, Fastify's raw server...). Returns a detach function.
 */
export function attachHocuspocus(
  httpServer: HttpServer,
  hocuspocus: Hocuspocus,
  { path = '/collab' }: AttachHocuspocusOptions = {},
): () => void {
  if (!path.startsWith('/') || path.includes('?') || path.includes('#') || path.startsWith('//')) {
    throw new Error('[collab] invalid WebSocket path');
  }
  const wss = new WebSocketServer({ noServer: true, ...websocketOptions });

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = parseUpgradeUrl(request);
    if (!url) return void socket.destroy();
    if (url.pathname !== path) {
      // The only other listeners that may consume that upgrade are owned
      // by the host app; if there are none, close instead of hanging.
      if (httpServer.listenerCount('upgrade') === 1) socket.destroy();
      return;
    }
    if (wss.clients.size >= MAX_SOCKETS) return void socket.destroy();
    try {
      const fetchRequest = toFetchRequest(request, url);
      wss.handleUpgrade(request, socket, head, (ws) => {
        const connection = hocuspocus.handleConnection(ws, fetchRequest);
        ws.on('message', (data, isBinary) => {
          if (isBinary) connection.handleMessage(toBytes(data));
          else ws.close(1003, 'Binary messages required');
        });
        ws.on('close', (code, reason) => connection.handleClose({ code, reason: reason.toString() }));
        ws.on('error', () => ws.terminate());
      });
    } catch {
      socket.destroy();
    }
  };

  httpServer.on('upgrade', onUpgrade);
  return () => {
    httpServer.off('upgrade', onUpgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}

/** Close every connection and flush debounced stores before the process exits. */
export async function shutdownHocuspocus(hocuspocus: Hocuspocus, timeoutMs = 5000): Promise<void> {
  hocuspocus.closeConnections();
  const deadline = Date.now() + timeoutMs;
  do {
    hocuspocus.flushPendingStores();
    if (hocuspocus.getDocumentsCount() === 0 && hocuspocus.loadingDocuments.size === 0) break;
    if (Date.now() >= deadline) throw new Error('[collab] shutdown timed out waiting for snapshot persistence');
    await wait(20);
  } while (true);
  await hocuspocus.hooks('onDestroy', { instance: hocuspocus });
}
