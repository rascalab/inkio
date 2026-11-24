import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { clearCollabCache, type CollabCacheScope } from '@inkio/collab';

const sessionUrl = '/api/collab-auth/session';
const changeChannel = 'inkio-react-router-collab-auth';
const deploymentId = import.meta.env.VITE_COLLAB_AUTH_DEPLOYMENT_ID
  || `react-router-auth-demo:${location.origin}${import.meta.env.BASE_URL}`;

const verificationFailure = 'Could not verify your session. Check your network or try again.';
export const authenticatedDocId = 'shared-doc';

type Session = { accountId: 'editor' | 'viewer'; role: 'write' | 'read'; binding: string };
type Operation = 'check' | 'sign-in' | 'sign-out';
type Actions = {
  check: () => void;
  signIn: (username: string, password: string) => void;
  signOut: (session: Session) => void;
};

// Cookie writes and logout cache deletion finish even if the SPA route unmounts.
// A remounted route must wait for them before asking which account is signed in.
let sessionMutation: Promise<void> | undefined;

export function authenticatedCacheScope(accountId: Session['accountId']): CollabCacheScope {
  return { accountId, deploymentId };
}

function requestSession(options: RequestInit) {
  return fetch(sessionUrl, { cache: 'no-store', credentials: 'same-origin', redirect: 'error', ...options });
}

async function readSession(response: Response): Promise<Session | null> {
  if (response.status === 401) return null;
  if (response.status !== 200) throw new Error('Session request failed.');
  const body: unknown = await response.json();
  if (body && typeof body === 'object' && 'accountId' in body && 'role' in body
    && (body.accountId === 'editor' || body.accountId === 'viewer')
    && (body.role === 'write' || body.role === 'read')
    && 'binding' in body && typeof body.binding === 'string' && /^[0-9a-f]{32}$/.test(body.binding)) {
    return { accountId: body.accountId, role: body.role, binding: body.binding };
  }
  throw new Error('Invalid session response.');
}

export function useCollabAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [operation, setOperation] = useState<Operation | null>('check');
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const actions = useRef<Actions | null>(null);
  const verifySession = useCallback(() => actions.current?.check(), []);

  useEffect(() => {
    let active = true;
    let checkRequest: AbortController | undefined;
    let writing = false;
    let refreshAfterWrite = false;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(changeChannel);

    function announceChange() {
      if (!channel) return;
      if (active) {
        channel.postMessage(null);
      } else {
        const sender = new BroadcastChannel(changeChannel);
        sender.postMessage(null);
        sender.close();
      }
    }

    async function check() {
      if (writing) {
        refreshAfterWrite = true;
        return;
      }
      checkRequest?.abort();
      const request = new AbortController();
      checkRequest = request;
      setOperation('check');
      try {
        await sessionMutation?.catch(() => {});
        if (request.signal.aborted) return;
        const verified = await readSession(await requestSession({ method: 'GET', signal: request.signal }));
        if (request.signal.aborted) return;
        setSession(verified);
        setNotice((current) => current === verificationFailure ? '' : current);
      } catch {
        if (!request.signal.aborted) setNotice(verificationFailure);
      } finally {
        if (!request.signal.aborted) {
          checkRequest = undefined;
          setOperation(null);
        }
      }
    }

    async function mutate(kind: 'sign-in' | 'sign-out', run: () => Promise<void>, failure: string) {
      if (writing || checkRequest) return;
      writing = true;
      setOperation(kind);
      setNotice('');
      const work = run();
      sessionMutation = work;
      try {
        await work;
      } catch {
        if (active) setNotice(failure);
      } finally {
        if (sessionMutation === work) sessionMutation = undefined;
        writing = false;
        if (active) {
          if (refreshAfterWrite) {
            refreshAfterWrite = false;
            void check();
          } else {
            setOperation(null);
          }
        }
      }
    }

    actions.current = {
      check: () => void check(),
      signIn: (username, password) => void mutate('sign-in', async () => {
        const response = await requestSession({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const verified = await readSession(response);
        if (verified) announceChange();
        if (!active) return;
        if (!refreshAfterWrite) setSession(verified);
        if (!verified) setNotice('Username or password is incorrect.');
      }, 'Could not sign in. Check your network or try again.'),
      signOut: (verified) => void mutate('sign-out', async () => {
        const response = await requestSession({ method: 'DELETE', headers: { 'X-Inkio-Session': verified.binding } });
        if (response.status === 409) {
          if (active) {
            setSession(null);
            refreshAfterWrite = true;
          }
          return;
        }
        if (response.status !== 204) throw new Error('Sign-out request failed.');

        // Unmount the editor (and destroy its provider, Y.Doc and persistence) before deleting its cache.
        // https://react.dev/reference/react-dom/flushSync#flushing-updates-for-third-party-integrations
        if (active) flushSync(() => setSession(null));
        announceChange();
        try {
          if (typeof indexedDB !== 'undefined') {
            await clearCollabCache(authenticatedDocId, authenticatedCacheScope(verified.accountId));
          }
          if (active) setNotice('Signed out. The local document cache was cleared.');
        } catch {
          if (active) setNotice('The session ended, but the local document cache could not be cleared.');
        }
      }, 'Could not sign out. Reconnect and try again.'),
    };

    const onOnline = () => {
      setOnline(true);
      void check();
    };
    const onOffline = () => setOnline(false);
    const onFocus = () => { if (navigator.onLine) void check(); };
    if (channel) channel.onmessage = () => {
      // Don't expose the previous account's document while a new cookie is being verified.
      flushSync(() => setSession(null));
      if (!writing) setNotice('');
      void check();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onFocus);
    void check();
    return () => {
      active = false;
      checkRequest?.abort();
      actions.current = null;
      channel?.close();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { session, operation, notice, online, actions, verifySession };
}
