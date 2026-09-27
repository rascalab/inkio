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
- Split mode (two processes, one machine or two):
  - `src/api-main.ts` — Nest API only (`PORT` default 3100): serves `POST /collab/verify`
    via `src/nest/verify.controller.ts` (`EDITOR_TOKENS`/`VIEWER_TOKENS`, comma-separated).
  - `src/sync-main.ts` — standalone sync (`PORT` default 3123): documents + WebSocket only,
    access checks delegated to `VERIFY_URL` via `createHttpVerify()` (`src/split.ts`, fail-closed).
  - `docker-compose.yml` — runs both (`pnpm build` first; set real token env vars).

```bash
pnpm --filter example-collab-server start:api    # http://localhost:3100/collab/verify
pnpm --filter example-collab-server start:sync   # ws://localhost:3123 (verify via the API)
```

> Development defaults only: `main.ts` wires no `verify`, so anyone can read
> and write any document. Add a token check before exposing it.

```bash
pnpm --filter example-collab-server build
pnpm --filter example-collab-server start   # ws://localhost:3123/collab
pnpm --filter example-collab-server smoke   # standalone + Nest, self-contained
```
