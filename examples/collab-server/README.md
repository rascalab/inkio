# example-collab-server

Reference [Hocuspocus](https://tiptap.dev/docs/hocuspocus/introduction) server for
`@inkio/collab`, runnable standalone or embedded in NestJS. Not published. Node 22+.

- `src/config.ts` — `createCollabConfiguration({ dataDir, verify, debounce })`: one
  `<docId>.ydoc` snapshot per document (loaded on first join, debounced
  write-then-rename), `verify(token, docId)` → `'write'` | `'read'` (server-enforced
  read-only) | `false`.
- `src/server.ts` — `createInkioCollabServer()`: standalone server (own port).
- `src/embed.ts` — `attachHocuspocus(httpServer, hocuspocus, { path })`: serve on an HTTP
  server you already own; only upgrades on `path` are taken. `shutdownHocuspocus()`
  flushes pending stores.
- `src/nest/collab.module.ts` — `InkioCollabModule.forRoot({ dataDir, verify, path })`:
  same port as the Nest app, WebSocket on `/collab`. Inject `INKIO_HOCUSPOCUS` for
  server-side document access. Call `app.enableShutdownHooks()`.
- `src/main.ts` — NestJS bootstrap (`PORT` default 3123, `DATA_DIR` default `./data`).

> Development defaults only: `main.ts` wires no `verify`, so anyone can read
> and write any document. Add a token check before exposing it.

```bash
pnpm --filter example-collab-server build
pnpm --filter example-collab-server start   # ws://localhost:3123/collab
pnpm --filter example-collab-server smoke   # standalone + Nest, self-contained
```
