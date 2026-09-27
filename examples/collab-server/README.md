# example-collab-server

Reference [Hocuspocus](https://tiptap.dev/docs/hocuspocus/introduction) server for
`@inkio/collab`. Not published. Requires Node 22+.

- `src/server.ts` — `createInkioCollabServer({ port, dataDir, verify, debounce })`:
  one `<docId>.ydoc` snapshot per document (loaded on first join, debounced
  write-then-rename on change), `verify(token, docId)` returning `'write'`,
  `'read'` (server-enforced read-only) or `false`.
- `src/main.ts` — standalone bootstrap (`PORT` default 3123, `DATA_DIR` default `./data`).

> Development defaults only: `main.ts` wires no `verify`, so anyone can read
> and write any document. Add a token check before exposing it.

```bash
pnpm --filter example-collab-server build
pnpm --filter example-collab-server start
pnpm --filter example-collab-server smoke  # self-contained: sync + restart/reload
```
