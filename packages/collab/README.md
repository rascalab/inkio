# @inkio/collab

Yjs real-time collaboration for Inkio editors. Ships the client side only:
Y.Doc wiring, a socket.io provider, collaborative editor hooks, and presence.

## Install

```bash
pnpm add @inkio/collab yjs y-protocols socket.io-client
```

`yjs`, `y-protocols`, and `socket.io-client` stay external so the host app shares
a single copy. `y-indexeddb` is optional (offline persistence).

## Use

```tsx
import { useInkioCollaborativeEditor, CollabPresence } from '@inkio/collab';
import { EditorContent } from '@tiptap/react';

function Room({ docId, token }: { docId: string; token: string }) {
  const { editor, provider, status } = useInkioCollaborativeEditor({
    docId,
    url: 'http://localhost:3123',
    token,
    user: { name: 'Ada', color: '#ff0077' },
    initialContent: '<p>Start here</p>',
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

Rules the hooks enforce for you:

- `history`/`undoRedo` extensions are stripped in collab mode (they fight the Yjs
  undo manager). Pass any other base `extensions`, or omit for core defaults.
- `initialContent` is seeded once, and only when the shared doc is still empty
  after the first sync — never pass `content` alongside a shared doc.
- Everything is created client-side (`isBrowser()` guard); importing this package
  in Node/SSR is side-effect free.

## Bring your own socket

Pass an existing socket.io-client `Socket` and the provider joins on it instead of
dialing a new connection:

```ts
const provider = new SocketIOCollabProvider({ docId, socket: existingSocket, token });
provider.connect();
```

The provider never disconnects a socket it did not create. Transport options
(`socket`, `url`, `token`) are read once per `docId` mount; pass a stable socket
and rotate credentials through a `token` function, which is re-evaluated on
 every join.

## Server side

No server ships with this package. Speak the wire protocol exported from
`@inkio/collab/protocol` (dependency-free, Node-safe; servers never import the
React entry) or copy `examples/collab-server` — a NestJS `InkioCollabModule.forRoot()` reference
with room-per-doc relay, a `verify` auth hook, and a throttled `onPersist` hook,
plus `attachToExistingServer()` for apps that already own a socket.io server.

## Offline

```ts
import { persistDocToIndexedDB } from '@inkio/collab';
persistDocToIndexedDB(docId, doc);
```

## Presence

Awareness states carry `{ user: { name, color } }`. `CollabPresence` renders online
peers; `useCollabPeers(provider)` gives you the raw list. In-editor remote carets
are intentionally out of scope: Tiptap v3's collaboration binding keeps its sync
plugin key private, so `y-prosemirror`'s cursor plugin cannot attach to it.
