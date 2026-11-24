import { useRef, useState, type FormEvent } from 'react';
import { EditorContent, useInkioCollaborativeEditor } from '@inkio/collab';
import { OfflineAppStatus } from './OfflineAppStatus';

const collabUrl = import.meta.env.VITE_COLLAB_URL || 'ws://127.0.0.1:3123/collab';
const cacheScope = {
  // This local demo represents one account. A production app must use its authenticated account ID.
  accountId: 'react-router-local-demo',
  deploymentId: import.meta.env.VITE_COLLAB_DEPLOYMENT_ID || `react-router-demo:${collabUrl}`,
};

function SharedDocument({ token }: { token: string }) {
  const { editor, status, readOnly } = useInkioCollaborativeEditor({
    docId: 'shared-doc',
    url: collabUrl,
    token,
    ariaLabel: 'Shared document editor',
    content: '<p>Write something together.</p>',
    offline: cacheScope,
  });

  const message = {
    connecting: 'Connecting…',
    synced: readOnly ? 'Synced (read only)' : 'Synced',
    disconnected: 'Disconnected',
    unauthorized: 'Could not authorize this room. If your token was denied, enter a new one.',
  }[status];

  return (
    <>
      <p role="status">{message}</p>
      {editor && <EditorContent className="inkio collab-editor" editor={editor} />}
    </>
  );
}

export default function CollabRoute() {
  const [token, setToken] = useState('');
  const tokenInput = useRef<HTMLInputElement>(null);

  const connect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = tokenInput.current;
    if (!input?.value) return;
    setToken(input.value);
    input.value = '';
  };

  return (
    <section>
      <h1>Shared document</h1>
      <p>This demo uses one local test identity. Enter the server token each time you reopen it.</p>
      <OfflineAppStatus />
      <form className="collab-form" onSubmit={connect} autoComplete="off">
        <label>
          Collaboration token
          <input ref={tokenInput} type="password" autoComplete="off" required />
        </label>
        <button type="submit">Connect</button>
      </form>
      <p className="draft-note">A cached document reopens read-only until it syncs with write access.</p>
      {token && <SharedDocument token={token} />}
    </section>
  );
}
