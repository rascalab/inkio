# @inkio/collab

Yjs real-time collaboration for Inkio editors on top of
[Hocuspocus](https://tiptap.dev/docs/hocuspocus/introduction): provider wiring,
a collaborative editor hook with remote carets, presence, offline caching and
race-free seeding. The server is yours — start from `examples/collab-server`.

## Install

```bash
pnpm add @inkio/collab yjs
```

`yjs`, `@hocuspocus/*` and `y-indexeddb` stay external so the host app shares a
single copy.

## Use

```tsx
import { useInkioCollaborativeEditor, CollabPresence, EditorContent } from '@inkio/collab';

function Room({ docId, token, accountId }: { docId: string; token: string; accountId: string }) {
  const { editor, provider, status, readOnly } = useInkioCollaborativeEditor({
    docId,
    url: 'ws://127.0.0.1:3123/collab',
    token,
    user: { name: 'Ada', color: '#ff0077' },
    content: '<p>Start here</p>',
    offline: { accountId, deploymentId: 'local-notebook' },
  });
  return (
    <>
      <span role="status">{status}{readOnly ? ' (read only)' : ''}</span>
      <CollabPresence provider={provider} />
      {editor && <EditorContent editor={editor} />}
    </>
  );
}
```

What the hook handles:

- Strips `history`/`undoRedo` (they fight the Yjs undo manager) and adds
  `Collaboration` plus self-styled remote carets.
- `content` seeds an empty doc after writable sync. Use the same schema, field
  and seed in every client of the room. Different concurrent seeds are distinct
  content and both may appear. For rolling upgrades, seed once on the server
  instead (pass JSON to `createSeedUpdate(schema, json)`; HTML needs a DOM).
- A server-granted read-only scope sets `readOnly`; editing never starts before
  writable sync. `unauthorized` hides the editor. Transient auth failures retry
  the affected room with backoff; an explicit denial waits for new credentials.
  Tokens are read on every handshake. Changing a rejected string token retries
  without rebuilding the editor; after refreshing a token function use
  `retryCollabAuthentication(provider)` to retry immediately.
- `offline: { accountId, deploymentId }` opts in to IndexedDB. These stable
  non-secret IDs separate accounts, deployments and tenants; use a distinct
  `deploymentId` wherever room IDs or data isolation differ, even on one
  WebSocket origin. A cold offline mount can display its scoped cache read-only.
  An already-authorized writer can keep editing during a network interruption
  unless the server has denied access. IndexedDB is not an authorization or
  encryption boundary.
- The provider lives in an effect, so StrictMode's double mount is safe.

Several documents on one Hocuspocus v4 server can share one connection via
`new HocuspocusProviderWebsocket({ url })` passed as `websocketProvider`. Use a
separate socket for another server. The example's standalone and split servers
use `ws://127.0.0.1:3123` without `/collab`; the default embedded server uses
`/collab`. Use `wss://` for deployments.

Lower-level building blocks: `createCollabProvider`, `getCollabStatus`,
`onCollabStatus`, `createCollabExtensions`, `seedYDoc`/`createSeedUpdate`,
`persistDocToIndexedDB(docId, doc, scope)`, `loadIndexedDBState(docId, doc, scope)`,
`clearCollabCache(docId, scope)`, `useCollabPeers`.

On logout or account change, unmount the old session and close the persistence
before clearing its scoped cache. Never reuse a caller-managed `Y.Doc` across
accounts, deployments, or rooms; prefer the hook-owned document. Legacy caches
named only by room ID are intentionally not loaded. Sync pending changes with
the original account/server before upgrading and explicitly remove old local
data afterward; do not copy an unscoped cache into a guessed account.

Already-seeded docs remain readable after upgrading. The `SEED_CLIENT_ID`
constant is no longer exported; seed authors are derived from the content.
Avoid mixing old and new client seeding on a newly created room.
