import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createAuthSessions } from '../examples/collab-server/src/auth-sessions';

describe('React Router collaboration sessions', () => {
  it('does not reconnect or sign out a replacement login using the previous tab’s session binding', async () => {
    const editorPassword = randomBytes(24).toString('hex');
    const viewerPassword = randomBytes(24).toString('hex');
    vi.stubEnv('COLLAB_AUTH_EDITOR_PASSWORD', editorPassword);
    vi.stubEnv('COLLAB_AUTH_VIEWER_PASSWORD', viewerPassword);
    const server = createServer();
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing test server port');
      const origin = new URL(`http://127.0.0.1:${address.port}`);
      const sessions = await createAuthSessions(origin);
      try {
        server.on('request', (request, response) => void sessions.handle(request, response, origin.host));
        const url = new URL('/api/collab-auth/session', origin);
        const login = async (username: string, password: string, cookie = '') => {
          const response = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin.origin, Cookie: cookie },
            body: JSON.stringify({ username, password }),
          });
          expect(response.status).toBe(200);
          const { binding } = await response.json();
          return { binding, cookie: response.headers.get('Set-Cookie')!.split(';')[0] };
        };
        const editor = await login('editor', editorPassword);
        const viewer = await login('viewer', viewerPassword, editor.cookie);
        expect(viewer.binding).not.toBe(editor.binding);
        expect(sessions.find(viewer.cookie, editor.binding)).toBeUndefined();
        expect(sessions.find(viewer.cookie, viewer.binding)?.account.role).toBe('read');

        const signOut = (binding: string) => fetch(url, {
          method: 'DELETE', headers: { Origin: origin.origin, Cookie: viewer.cookie, 'X-Inkio-Session': binding },
        });
        expect((await signOut(editor.binding)).status).toBe(409);
        expect(sessions.find(viewer.cookie)).toBeDefined();
        expect((await signOut(viewer.binding)).status).toBe(204);
        expect(sessions.find(viewer.cookie)).toBeUndefined();
      } finally {
        sessions.stop();
      }
    } finally {
      await server[Symbol.asyncDispose]();
      vi.unstubAllEnvs();
    }
  });
});
