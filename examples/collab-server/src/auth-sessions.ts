import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { requiredEnv } from './env';
import { isServiceKey } from './limits';

const AUTH_PATH = '/api/collab-auth';
const SESSION_PATH = `${AUTH_PATH}/session`;
const COOKIE_NAME = 'inkio_collab_session';
const COOKIE_PREFIX = `${COOKIE_NAME}=`;
const SESSION_SECONDS = 30 * 60;
const MAX_SESSIONS = 128;
const MAX_BODY_BYTES = 1024;
const BODY_TIMEOUT_MS = 5000;
const LOGIN_WINDOW_MS = 60_000;
const MAX_LOGIN_ATTEMPTS = 12;
const MAX_PENDING_LOGINS = 2;

const accounts = {
  editor: { accountId: 'editor', role: 'write' },
  viewer: { accountId: 'viewer', role: 'read' },
} as const;

type AccountId = keyof typeof accounts;
type Account = (typeof accounts)[AccountId];
export type Session = {
  id: string;
  /** Public login generation, not a credential. The HttpOnly cookie is still required. */
  binding: string;
  account: Account;
  expiresAt: number;
  sockets: Set<Duplex>;
  timer: NodeJS.Timeout;
};

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function passwordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, { N: 65536, maxmem: 96 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return { salt, hash: await passwordKey(password, salt) };
}

async function configuredCredentials() {
  const editor = requiredEnv('COLLAB_AUTH_EDITOR_PASSWORD');
  const viewer = requiredEnv('COLLAB_AUTH_VIEWER_PASSWORD');
  if (!isServiceKey(editor) || !isServiceKey(viewer) || editor === viewer) {
    throw new Error('[collab-auth] configure distinct random editor and viewer passwords (32–128 URL-safe characters)');
  }
  return { editor: await hashPassword(editor), viewer: await hashPassword(viewer) };
}

function sessionId(cookie: string | null | undefined): string | undefined {
  let id: string | undefined;
  for (const field of cookie?.split(';') ?? []) {
    const pair = field.trim();
    if (!pair.startsWith(COOKIE_PREFIX)) continue;
    const value = pair.slice(COOKIE_PREFIX.length);
    if (id !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(value)) return;
    id = value;
  }
  return id;
}

function readLogin(request: IncomingMessage): Promise<{ username: string; password: string }> {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type');
  }
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'body_too_large');
  }

  const { promise, resolve, reject } = Promise.withResolvers<{ username: string; password: string }>();
  const chunks: Buffer[] = [];
  let size = 0;
  const timer = setTimeout(() => fail(new HttpError(408, 'body_timeout')), BODY_TIMEOUT_MS);

  function cleanup() {
    clearTimeout(timer);
    request.off('data', onData);
    request.off('end', onEnd);
    request.off('close', onClose);
  }

  function fail(error: HttpError) {
    cleanup();
    request.pause();
    reject(error);
  }

  function onData(chunk: Buffer) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) fail(new HttpError(413, 'body_too_large'));
    else chunks.push(chunk);
  }

  function onEnd() {
    cleanup();
    try {
      const bytes = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, size);
      const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (input !== null && typeof input === 'object' && 'username' in input && 'password' in input &&
        typeof input.username === 'string' && typeof input.password === 'string') {
        resolve({ username: input.username, password: input.password });
        return;
      }
    } catch {
      // Malformed UTF-8 or JSON is invalid input, not an authentication failure.
    }
    reject(new HttpError(400, 'invalid_body'));
  }

  function onClose() {
    fail(new HttpError(400, 'invalid_body'));
  }

  // A client can abort before or after a body-limit rejection.
  request.once('error', onClose);
  request.once('close', onClose);
  request.once('end', onEnd);
  request.on('data', onData);
  return promise;
}

function sendJson(response: ServerResponse, status: number, data: (Account & { binding: string }) | { error: string }) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

export async function createAuthSessions(origin: URL) {
  const credentials = await configuredCredentials();
  const sessions = new Map<string, Session>();
  let loginWindowEndsAt = 0;
  let loginAttempts = 0;
  let pendingLogins = 0;
  let stopping = false;

  function cookie(id: string, maxAge: number) {
    // The frontend's configured origin is authoritative; do not trust forwarded headers.
    return `${COOKIE_PREFIX}${id}; Path=${AUTH_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict` +
      (origin.protocol === 'https:' ? '; Secure' : '');
  }

  function revoke(id: string) {
    const session = sessions.get(id);
    if (!session) return;
    sessions.delete(id);
    clearTimeout(session.timer);
    for (const socket of session.sockets) socket.destroy();
    session.sockets.clear();
  }

  function active(session: Session): boolean {
    if (sessions.get(session.id) !== session) return false;
    if (performance.now() < session.expiresAt) return true;
    revoke(session.id);
    return false;
  }

  function find(cookieHeader: string | null | undefined, binding?: string): Session | undefined {
    const id = sessionId(cookieHeader);
    const session = id === undefined ? undefined : sessions.get(id);
    return session && active(session) && (binding === undefined || session.binding === binding) ? session : undefined;
  }

  function issue(account: Account): Session {
    const id = randomBytes(32).toString('base64url');
    const lifetime = SESSION_SECONDS * 1000;
    const session = {
      id, binding: randomBytes(16).toString('hex'), account,
      expiresAt: performance.now() + lifetime, sockets: new Set<Duplex>(),
      timer: setTimeout(() => revoke(id), lifetime).unref(),
    };
    sessions.set(id, session);
    return session;
  }

  async function login(request: IncomingMessage, response: ServerResponse) {
    // All traffic arrives from loopback (typically the same Vite proxy). Bound work globally
    // rather than accepting a client-controlled forwarding header as a rate-limit key.
    const now = performance.now();
    if (now >= loginWindowEndsAt) {
      loginWindowEndsAt = now + LOGIN_WINDOW_MS;
      loginAttempts = 0;
    }
    if (pendingLogins >= MAX_PENDING_LOGINS || loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      response.setHeader('Retry-After', loginAttempts >= MAX_LOGIN_ATTEMPTS
        ? Math.ceil((loginWindowEndsAt - now) / 1000) : 1);
      throw new HttpError(429, 'too_many_attempts');
    }
    loginAttempts++;
    pendingLogins++;
    try {
      const { username, password } = await readLogin(request);
      const account = username === 'editor' || username === 'viewer' ? accounts[username] : undefined;
      // Do the same work for unknown usernames, and compare equal-length derived keys.
      const { salt, hash } = credentials[account?.accountId ?? 'editor'];
      const matches = timingSafeEqual(await passwordKey(password, salt), hash);
      if (!matches || !account) throw new HttpError(401, 'invalid_credentials');
      if (response.destroyed) return;
      if (stopping) throw new HttpError(503, 'session_unavailable');
      const old = find(request.headers.cookie);
      if (!old && sessions.size >= MAX_SESSIONS) throw new HttpError(503, 'session_unavailable');
      if (old) revoke(old.id);
      const session = issue(account);
      response.setHeader('Set-Cookie', cookie(session.id, SESSION_SECONDS));
      sendJson(response, 200, { ...account, binding: session.binding });
    } finally {
      pendingLogins--;
    }
  }

  async function handle(request: IncomingMessage, response: ServerResponse, backendHost: string) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (request.url !== SESSION_PATH) throw new HttpError(404, 'not_found');
      if (request.headers.host !== origin.host && request.headers.host !== backendHost) {
        throw new HttpError(403, 'forbidden');
      }
      const method = request.method;
      if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
        response.setHeader('Allow', 'GET, POST, DELETE');
        throw new HttpError(405, 'method_not_allowed');
      }
      if ((method !== 'GET' || request.headers.origin !== undefined) && request.headers.origin !== origin.origin) {
        throw new HttpError(403, 'forbidden');
      }
      if (method === 'POST') {
        await login(request, response);
      } else if (method === 'DELETE') {
        const session = find(request.headers.cookie);
        if (session) {
          if (request.headers['x-inkio-session'] !== session.binding) throw new HttpError(409, 'session_changed');
          revoke(session.id);
          response.setHeader('Set-Cookie', cookie('', 0));
        }
        response.writeHead(204);
        response.end();
      } else {
        const session = find(request.headers.cookie);
        if (!session) throw new HttpError(401, 'no_session');
        sendJson(response, 200, { ...session.account, binding: session.binding });
      }
    } catch (error) {
      if (response.destroyed || response.headersSent) return;
      if (!request.readableEnded) response.setHeader('Connection', 'close');
      if (error instanceof HttpError) sendJson(response, error.status, { error: error.code });
      else sendJson(response, 500, { error: 'internal_error' });
    }
  }

  return {
    active, find, handle,
    stop() {
      stopping = true;
      for (const id of sessions.keys()) revoke(id);
    },
  };
}
