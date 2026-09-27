import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer, type RawData } from 'ws';

export interface AttachHocuspocusOptions {
  /** Only upgrades on this path are taken; everything else is left alone. */
  path?: string;
}

function toFetchRequest(request: IncomingMessage): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }
  return new Request(`http://${request.headers.host ?? 'localhost'}${request.url ?? '/'}`, { headers });
}

function toBytes(data: RawData): Uint8Array {
  const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
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
  const wss = new WebSocketServer({ noServer: true });

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname !== path) return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      const connection = hocuspocus.handleConnection(ws, toFetchRequest(request));
      ws.on('message', (data) => connection.handleMessage(toBytes(data)));
      ws.on('close', (code, reason) => connection.handleClose({ code, reason: reason.toString() }));
      ws.on('error', (error) => console.error('[collab] websocket error:', error));
    });
  };

  httpServer.on('upgrade', onUpgrade);
  return () => {
    httpServer.off('upgrade', onUpgrade);
    wss.close();
  };
}

/** Close every connection and flush debounced stores before the process exits. */
export async function shutdownHocuspocus(hocuspocus: Hocuspocus, timeoutMs = 5000): Promise<void> {
  hocuspocus.closeConnections();
  hocuspocus.flushPendingStores();
  const deadline = Date.now() + timeoutMs;
  while (hocuspocus.getDocumentsCount() > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await hocuspocus.hooks('onDestroy', { instance: hocuspocus });
}
