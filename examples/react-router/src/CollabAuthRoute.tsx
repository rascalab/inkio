import { useEffect, type FormEvent } from 'react';
import { EditorContent, useInkioCollaborativeEditor, type CollabCacheScope } from '@inkio/collab';
import { OfflineAppStatus } from './OfflineAppStatus';
import { authenticatedCacheScope, authenticatedDocId, useCollabAuth } from './useCollabAuth';

const socketUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/collab-auth/socket`;

function AuthenticatedDocument({ scope, binding, editable, verifySession }: {
  scope: CollabCacheScope;
  binding: string;
  editable: boolean;
  verifySession: () => void;
}) {
  const { editor, status, readOnly } = useInkioCollaborativeEditor({
    docId: authenticatedDocId,
    url: socketUrl,
    // Identifies the expected login; only its matching HttpOnly cookie authorizes access.
    token: binding,
    editable,
    ariaLabel: 'Shared document editor',
    content: '<p>Write something together.</p>',
    offline: scope,
  });

  useEffect(() => {
    if (status === 'unauthorized') verifySession();
  }, [status, verifySession]);

  const message = {
    connecting: 'Connecting…',
    synced: readOnly ? 'Synced (read only)' : 'Synced',
    disconnected: 'Disconnected from collaboration.',
    unauthorized: 'Could not authorize this room. Checking your session.',
  }[status];

  return (
    <>
      <p id="collab-auth-sync" role="status">{message}</p>
      {editor && <EditorContent className="inkio collab-editor" editor={editor} />}
    </>
  );
}

export default function CollabAuthRoute() {
  const { session, operation, notice, online, actions, verifySession } = useCollabAuth();
  const busy = operation !== null;
  let status = session ? 'Your session is verified.' : 'Sign in to open the shared document.';
  if (operation === 'sign-out') status = 'Signing out…';
  else if (operation === 'sign-in') status = 'Signing in…';
  else if (!online) {
    status = session
      ? 'You are offline. This open session can still use its local document cache.'
      : 'You are offline. Connect to verify your session before opening the document.';
  } else if (operation === 'check') status = 'Checking your session…';

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const form = event.currentTarget;
    const { username, password } = Object.fromEntries(new FormData(form));
    if (typeof username !== 'string' || typeof password !== 'string') return;
    form.reset();
    actions.current?.signIn(username, password);
  }

  return (
    <section>
      <h1>Authenticated collaboration</h1>
      <p>Sign in with the local editor or viewer account to open the shared document.</p>
      <OfflineAppStatus />
      <p className="draft-note">The app shell can reopen offline. Opening the document after a reload still requires a server session check.</p>
      {session && <p id="collab-auth-account">Signed in as <strong>{session.accountId}</strong> ({session.role === 'write' ? 'can edit' : 'read only'}).</p>}
      <p id="collab-auth-status" role="status">{status}{notice ? ` ${notice}` : ''}</p>
      {session ? (
        <>
          <div className="collab-form">
            <button type="button" disabled={busy || !online} onClick={() => actions.current?.signOut(session)}>Sign out</button>
          </div>
          <AuthenticatedDocument
            key={session.binding}
            binding={session.binding}
            scope={authenticatedCacheScope(session.accountId)}
            editable={session.role === 'write' && operation !== 'sign-out'}
            verifySession={verifySession}
          />
        </>
      ) : (
        <form className="collab-form" method="post" onSubmit={signIn} autoComplete="off">
          <label htmlFor="collab-auth-username">
            Username
            <input id="collab-auth-username" name="username" autoCapitalize="none" autoComplete="off" required disabled={busy || !online} />
          </label>
          <label htmlFor="collab-auth-password">
            Password
            <input id="collab-auth-password" name="password" type="password" autoComplete="off" required disabled={busy || !online} />
          </label>
          <button type="submit" disabled={busy || !online}>Sign in</button>
          {notice && <button type="button" disabled={busy || !online} onClick={verifySession}>Check session again</button>}
        </form>
      )}
    </section>
  );
}
