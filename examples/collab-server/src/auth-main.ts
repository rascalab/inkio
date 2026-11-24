import { once } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Server } from '@hocuspocus/server';
import { createAuthSessions, type Session } from './auth-sessions';
import { createCollabConfiguration } from './config';
import { shutdownHocuspocus, websocketOptions } from './embed';
import { listenOptions, requiredEnv } from './env';
import { MAX_SOCKETS } from './limits';

const SOCKET_PATH = '/api/collab-auth/socket';
const DOCUMENT = 'shared-doc';
const SESSION_ENDED = { code: 1008, reason: 'inkio:session-ended' };

function frontendOrigin() {
  const configured = requiredEnv('COLLAB_AUTH_ORIGIN');
  const origin = URL.canParse(configured) ? new URL(configured) : undefined;
  if (!origin || origin.origin !== configured || !['http:', 'https:'].includes(origin.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error('[collab-auth] COLLAB_AUTH_ORIGIN must be an exact loopback HTTP(S) origin');
  }
  return origin;
}

function rejectUpgrade(socket: Duplex, status: string): never {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n`);
  // An empty rejection tells Hocuspocus not to run its default upgrade handler.
  throw undefined;
}

async function main() {
  const { port, host } = listenOptions(3124);
  if (host !== '127.0.0.1' && host !== '::1') {
    throw new Error('[collab-auth] COLLAB_HOST must be 127.0.0.1 or ::1; refusing non-loopback bind');
  }
  const origin = frontendOrigin();
  const dataDir = requiredEnv('DATA_DIR');
  const sessions = await createAuthSessions(origin);
  const sockets = new Set<Duplex>();
  const verifiedRequests = new WeakMap<Request, Session>();
  const config = createCollabConfiguration({
    dataDir,
    allowedOrigins: [origin.origin],
    verify(token, documentName, request) {
      // Bind this editor's verified login to the cookie at WebSocket upgrade.
      // A reconnect can otherwise pick up a different tab's replacement cookie.
      if (documentName !== DOCUMENT || !request || request.headers.get('origin') !== origin.origin) {
        return false;
      }
      const session = sessions.find(request.headers.get('cookie'), token);
      if (!session) return false;
      verifiedRequests.set(request, session);
      return session.account.role;
    },
  });

  function requireActiveSession(request: Request) {
    const session = verifiedRequests.get(request);
    if (!session || !sessions.active(session)) throw SESSION_ENDED;
  }

  const server = new Server({
    ...config,
    address: host,
    port,
    stopOnSignals: false,
    websocketOptions,
    async onRequest({ request, response }) {
      await sessions.handle(request, response, backendHost());
      // The response is already written; suppress the native welcome page.
      throw undefined;
    },
    async onUpgrade({ request, socket }: { request: IncomingMessage; socket: Duplex }) {
      if (request.url !== SOCKET_PATH) rejectUpgrade(socket, '404 Not Found');
      if ((request.headers.host !== origin.host && request.headers.host !== backendHost()) ||
        request.headers.origin !== origin.origin) rejectUpgrade(socket, '403 Forbidden');
      if (sockets.size >= MAX_SOCKETS) rejectUpgrade(socket, '503 Service Unavailable');
      const session = sessions.find(request.headers.cookie);
      // Let Hocuspocus send its protocol denial for missing/expired sessions: a
      // failed HTTP upgrade cannot tell the browser client why it was refused.
      sockets.add(socket);
      session?.sockets.add(socket);
      socket.once('close', () => {
        sockets.delete(socket);
        session?.sockets.delete(socket);
      });
    },
    async beforeHandleMessage(payload) {
      await config.beforeHandleMessage?.(payload);
      requireActiveSession(payload.connection.request);
    },
    async beforeSync(payload) {
      await config.beforeSync?.(payload);
      // Also check at the sync boundary: queued work may outlive the socket.
      requireActiveSession(payload.connection.request);
    },
  });

  function backendHost() {
    return `${host === '::1' ? '[::1]' : host}:${server.address.port}`;
  }

  server.httpServer.headersTimeout = 5000;
  server.httpServer.requestTimeout = 10_000;
  server.httpServer.maxConnections = MAX_SOCKETS + 32;
  const listening = once(server.httpServer, 'listening');
  server.httpServer.listen(port, host);
  await listening;

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.httpServer.close();
    sessions.stop();
    for (const socket of sockets) if (!socket.destroyed) socket.destroy();
    void shutdownHocuspocus(server.hocuspocus).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : '[collab-auth] snapshot shutdown failed');
      process.exitCode = 1;
    }).finally(() => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log(`[collab-auth] loopback server listening on ${backendHost()}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : '[collab-auth] startup failed');
  process.exitCode = 1;
});
