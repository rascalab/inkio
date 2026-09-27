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
import { useInkioCollaborativeEditor, CollabPresence } from '@inkio/collab';
import { EditorContent } from '@tiptap/react';

function Room({ docId, token }: { docId: string; token: string }) {
  const { editor, provider, status, readOnly } = useInkioCollaborativeEditor({
    docId,
    url: 'ws://localhost:3123',
    token,
    user: { name: 'Ada', color: '#ff0077' },
    content: '<p>Start here</p>',
    offline: true,
  });
  if (!editor) return null;
  return (
    <>
      <span>{status}</span>
      <CollabPresence provider={provider} />
      <EditorContent editor={editor} />
    </>
  );
}
```

What the hook handles:

- Strips `history`/`undoRedo` (they fight the Yjs undo manager) and adds
  `Collaboration` plus self-styled remote carets.
- `content` seeds an empty doc with a deterministic update, so clients that join
  an empty room at the same time converge on one copy.
- `token` is read on every (re)connect; rotating it never rebuilds the editor.
- A server-granted read-only scope sets `readOnly` and makes the editor
  non-editable (the server rejects writes regardless).
- `offline: true` caches the doc in IndexedDB.
- The provider lives in an effect, so StrictMode's double mount is safe.

Several documents can share one connection via
`new HocuspocusProviderWebsocket({ url })` passed as `websocketProvider`.

Lower-level building blocks: `createCollabProvider`, `getCollabStatus`,
`onCollabStatus`, `createCollabExtensions`, `seedYDoc`/`createSeedUpdate`,
`persistDocToIndexedDB`, `loadIndexedDBState`, `useCollabPeers`.
