# @inkio/collab

Yjs real-time collaboration for Inkio editors on top of
[Hocuspocus](https://tiptap.dev/docs/hocuspocus/introduction): provider wiring,
a collaborative editor hook with remote carets, presence, offline caching and
race-free seeding. The server is yours — start from `examples/collab-server`.

## Install

```bash
pnpm add @inkio/collab @inkio/core yjs
```

`yjs`, `@hocuspocus/*` and `y-indexeddb` stay external so the host app shares a
single copy.

## Use

```tsx
import { useInkioCollaborativeEditor, CollabPresence, EditorContent } from '@inkio/collab';
import '@inkio/core/style.css';

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
    <div className="inkio inkio-editor inkio-container-default">
      <span role="status">{status}{readOnly ? ' (read only)' : ''}</span>
      <CollabPresence provider={provider} />
      {editor && <EditorContent editor={editor} />}
    </div>
  );
}
```

What the hook handles:

- Omit `extensions` or pass `[]` to keep the core defaults. A list adds or
  overrides extensions by name. For a custom base schema, pass
  `{ items: mySchemaExtensions, replace: true }` with a complete schema.
- Strips `history`/`undoRedo` (they fight the Yjs undo manager) and adds
  `Collaboration` plus self-styled remote carets.
- `content` seeds the empty `default` fragment after writable sync. Use the same schema, field
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
  unless the server has denied access. Reconnection reconciles local edits from
  the Y.Doc after authentication rather than replaying each offline keystroke.
  IndexedDB is not an authorization or encryption boundary.
- The hook creates the provider in an effect; `provider` and `editor` are
  initially `null`. It disposes the provider and its own Y.Doc on session
  change or unmount; a `doc` you supply remains yours to destroy.
- `readOnly` reports the server's scope, not whether the editor is currently
  editable. `editable: false` also disables editing, even for a writer.
- `onChange(editor)` sees local and remote document changes, coalesced per
  synchronous burst. Read `editor.text`, `editor.headings`, or another lazy
  projection without serializing JSON. Use `onUpdate(json)` for JSON snapshots.

Several documents on one Hocuspocus v4 server can share one connection via
`new HocuspocusProviderWebsocket({ url })` (exported by `@inkio/collab`) passed as
`websocketProvider`. Its owner must destroy it after the last room unmounts.
Use a separate socket for another server. The example's standalone and split servers
use `ws://127.0.0.1:3123` without `/collab`; the default embedded server uses
`/collab`. Use `wss://` for deployments.

## Reopen the app offline with Vite

IndexedDB persistence restores document data after the app loads; it does not
make the app load offline. For a static Vite 8 SPA, opt in to app-shell caching
in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { inkioOffline } from '@inkio/collab/vite';

export default defineConfig({
  base: '/preview/',
  plugins: [inkioOffline({ routes: ['/collab'] })],
});
```

Keep your other Vite plugins in the array. `routes` contains exact pathnames
relative to `base`, so the example covers `/preview/collab` but not
`/preview/collab/` or `/preview/collab/other`. Use `/` to cover the base itself.
Only use a same-origin, slash-prefixed base. The plugin runs only for builds;
the collab hook does not register a worker.

Deploy the build over HTTPS (localhost works for testing). Serve
`/preview/index.html` as an anonymous static file and route online
`/preview/collab` requests to the SPA. Serve the generated
`/preview/inkio-offline-register.js` and `/preview/inkio-offline-sw.js` as
JavaScript. The build injects the external registration script; if you set CSP,
allow it and the worker from the same origin. Deploy the HTML and built assets
without server-side rewriting because the worker checks their build-time hashes.
Registration leaves an unrelated worker with an overlapping scope untouched.

Visit the app online once and let the worker install. Later, an allowlisted
navigation uses the cached shell only if its network request fails, not when
the server returns an HTTP error or redirect. The worker only caches the
anonymous build output (HTML, registration script, bundled JS and CSS), not
API responses, tokens or user data. Do not allowlist auth or API endpoints, or
embed personalized content in the shell. To reopen a cached document, also
enable the hook's `offline` option and restore the same account and deployment
IDs. A cold offline session opens read-only until it reauthenticates.

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
