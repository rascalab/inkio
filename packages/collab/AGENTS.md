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
├── persistence.ts # IndexedDB save/load, one live persistence per docId
└── presence.tsx   # peer presence UI
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Server integration | examples/collab-server/ | Nest/Hocuspocus host; client points at its `ws://` URL |
| Doc seed / sync | src/seed.ts + src/ydoc.ts | seed applies to an empty doc; later seed changes ignored |
| Conflicting extensions | src/extensions.ts | strip before collab wiring |

## CONVENTIONS
- Single subpath: `.` only; no CSS.
- Transport is `@hocuspocus/provider` (+ yjs, y-protocols, y-indexeddb); no socket.io anywhere.
- All browser work behind `isBrowser()`; Node/SSR import is side-effect free.

## ANTI-PATTERNS
- Never pass `content` alongside a shared doc; seed applies to an empty doc once per synced session.
- Never open two live persistences for one docId (dual writers race on the same Y.Doc).
- Rejected (unauthorized) providers must not reconnect.
