# packages/collab AGENTS.md

Score: 12 (19 files, distinct realtime-collab domain). Parent covers monorepo-wide rules; this file covers the Yjs/socket.io layer only.

## OVERVIEW
Client-only realtime collaboration for core editors: Yjs doc sync over socket.io, presence, IndexedDB persistence.

## STRUCTURE
```
src/
├── provider.ts    # socket lifecycle, auth-status mapping, transport switch
├── hooks.ts       # useInkioCollaborativeEditor wiring
├── protocol.ts    # dependency-free Node-safe subset (`./protocol` for servers)
├── ydoc.ts        # Y.Doc helpers (empty-check, encode, remote apply)
├── extensions.ts  # COLLAB_CONFLICTING_EXTENSIONS removal
├── persistence.ts # IndexedDB save/load, one live persistence per docId
└── presence.tsx   # peer presence UI
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Server integration | src/protocol.ts + examples/collab-server/ | protocol has zero deps; Nest/Hocuspocus example consumes it |
| Doc seed / sync | src/ydoc.ts | seed set once on empty doc only |
| Conflicting extensions | src/extensions.ts | strip before collab wiring |

## CONVENTIONS
- Subpaths: `.` and `./protocol` only; `sideEffects: false`, no CSS.
- yjs/y-protocols/socket.io-client stay external so the host shares one copy.
- All browser work behind `isBrowser()`; Node/SSR import is side-effect free.
- Tests share `packages/core/src/test-setup.ts`; `@inkio/core` aliases to core source in dev/test.

## ANTI-PATTERNS
- Never pass `content` alongside a shared doc; seed applies to an empty doc once.
- Never open two live persistences for one docId.
- Provider never disconnects a socket it did not create; rejected (unauthorized/forbidden) clients must not reconnect on drops.
