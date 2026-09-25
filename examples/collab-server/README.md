# example-collab-server

Reference NestJS + socket.io collaboration server for `@inkio/collab`. Not published.

- `src/engine.ts` — transport-agnostic `CollabSyncEngine` (room = docId, Y.Doc per room,
  verify hook, throttled persist hook). Works with a NestJS gateway or an existing
  socket.io server via `InkioCollabModule.attachToExistingServer(server, options)`.
- `src/collab.module.ts` — `InkioCollabModule.forRoot(options)` NestJS dynamic module.
- `src/main.ts` — standalone bootstrap (`PORT`, default 3123).

Wire protocol (single source of truth): `@inkio/collab/protocol` subpath
(`inkio:collab:join/init/update/awareness/error` on namespace `/inkio-collab`).
The subpath is dependency-free and Node-safe.

```bash
pnpm --filter example-collab-server build
pnpm --filter example-collab-server start &  # or node examples/collab-server/dist/main.js
pnpm --filter example-collab-server smoke
```
