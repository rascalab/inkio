# packages/collab AGENTS.md

Score: 12 (19 files, distinct realtime-collab domain). Parent covers monorepo-wide rules; this file covers the Hocuspocus/Yjs layer only.

## OVERVIEW
Realtime collaboration for core editors: Yjs doc sync over Hocuspocus, presence, IndexedDB persistence.

## STRUCTURE
```
src/
├── provider.ts    # createCollabProvider, status mapping, token auth (Hocuspocus)
├── hooks.ts       # useInkioCollaborativeEditor wiring
├── seed.ts        # seedYDoc: seeds an empty shared doc, no-op when doc has content
├── ydoc.ts        # Y.Doc helpers (empty-check, encode)
├── doc-id.ts      # assertValidDocId + MAX_DOC_ID_LENGTH
├── persistence.ts # IndexedDB save/load scoped by deployment, account and room
├── presence.tsx   # peer presence UI
└── vite.ts        # optional Vite app-shell cache plugin (Node only)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Server integration | examples/collab-server/ | Nest/Hocuspocus host; client points at its `ws://` URL |
| Split hosting | examples/collab-server/src/sync-main.ts + api-main.ts | sync owns docs/WS, Nest owns verify via `createHttpVerify`; compose file included |
| Doc seed / sync | src/seed.ts + src/ydoc.ts | seed applies to an empty doc; later seed changes ignored |
| Conflicting extensions | src/extensions.ts | strip before collab wiring |

## CONVENTIONS
- Client API at `.`; optional Node-only Vite build plugin at `./vite`. No CSS entry.
- Transport is `@hocuspocus/provider` (+ yjs, y-protocols, y-indexeddb); no socket.io anywhere.
- React creates the provider in an effect, not during SSR. Use the Vite plugin only in build configuration.

## ANTI-PATTERNS
- `content` is a seed for an empty shared fragment after writable sync, not a controlled document. All clients seeding a room should agree on schema, field and content.
- Do not open two live persistences for the same scoped cache key on one Y.Doc.
- Retry transient failures per room. An explicit denial suppresses automatic auth retries for the current handshake; refresh credentials before retrying.
