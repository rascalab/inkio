# example-collab-server

Local reference server for `@inkio/collab`. It is not published. Requires Node
22+. The CLI defaults to loopback and refuses to start without explicit
configuration. No anonymous access or built-in room tokens.

## Embedded Nest server

```bash
pnpm --filter example-collab-server build
mkdir -p examples/collab-server/data
export DATA_DIR="$PWD/examples/collab-server/data"
export COLLAB_ROOM_ID=shared-doc
export COLLAB_EDITOR_TOKEN="$(openssl rand -hex 32)"
export COLLAB_VIEWER_TOKEN="$(openssl rand -hex 32)" # optional
pnpm --filter example-collab-server start
```

Connect to `ws://127.0.0.1:3123/collab` with that room ID and its editor or
viewer credential. `verify(token, docId, request)` is required when embedding
`InkioCollabModule.forRoot({ dataDir, verify, path })`, or when running
`createInkioCollabServer({ dataDir, verify })` on its own port. Standalone uses
`ws://127.0.0.1:3123` (no `/collab`). `attachHocuspocus` can attach the same
`createCollabConfiguration` to your own Node HTTP server.

The CLI verifier grants access only to `COLLAB_ROOM_ID`. For your app, use
short-lived credentials to authenticate the principal, then check their exact
tenant and document membership: return `'write'`, `'read'` or `false`; throw on
dependency outages. Read-only is enforced by the server. Never accept a client
room ID or a valid token alone as proof of access. Checks run per document at
handshake; close active sessions when grants change (e.g.
`hocuspocus.closeConnections(docId)`), and authorize every server-side direct
connection yourself. Presence names are display hints, not verified identity.

## Private verifier + sync server

Reuse the room/token environment above. Create a different secret for
server-to-server authentication. Run the commands in separate shells or
processes with the same environment:

```bash
export COLLAB_VERIFY_KEY="$(openssl rand -hex 32)"
# API only; do not publish this port
pnpm --filter example-collab-server start:api
# Sync process, in a separate shell with the shared environment
export VERIFY_URL=http://127.0.0.1:3100/collab/verify
pnpm --filter example-collab-server start:sync
```

Only the sync service calls `POST /collab/verify` with its private Bearer key
and `{ token, docId }`. The API resolves the user's document ACL and answers
`{ access: 'write' | 'read' | false }`. Non-200 responses, timeouts and invalid
bodies all block access. Bind the verifier to a private network and use HTTPS
across hosts; never put the service key in a client or a URL. `PORT` and
`COLLAB_HOST` override each process's bind address. Set
`COLLAB_ALLOWED_ORIGINS` to a comma-separated list of exact browser origins
when exposing sync; absence of an Origin header alone does not authenticate a
client. Use WSS, request/connection rate limits and application room quotas
behind a trusted proxy for network deployments.

Compose runs `api` and `sync` as non-root, mounts the repo read-only, and
publishes only sync at `127.0.0.1:3123`. Build first, export the three distinct
credentials and room ID, and ensure `examples/collab-server/data` exists and
is writable by the container's `node` user. The verifier API is not on a host
port. For an older Compose deployment, copy the old volume contents into the
new data directory before doing the snapshot migration below.

## Persistence and upgrades

Use a private `DATA_DIR` on a local filesystem supporting atomic rename and
file/directory sync. One sync process owns it. Room IDs start with a Unicode
letter or number and use at most 256 UTF-8 bytes of letters, numbers, marks,
`.`, `_`, or `-`. IDs are case-sensitive. This reference caps WebSocket
messages at 8 MiB, snapshots at 4 MiB and also bounds connections, pending
documents and presence. It is not a multi-replica persistence or quota service.

Snapshots now use `v2-<sha256 of exact UTF-8 room ID>.ydoc`; the binary
Yjs update format is unchanged. Stop old writers and back up existing data.
For each known valid room, calculate that SHA-256 (hexadecimal) and copy the
old `encodeURIComponent(docId) + '.ydoc'` file to its new name. Verify each
room against the backup; if old filenames collided on a case-insensitive
filesystem, recover the correct documents before importing. Remap IDs that
no longer meet the room-ID rules. Do not run old/new writers on the same
directory. Snapshots are not read under old names automatically.

Use `await server.destroy()` for a programmatic standalone server, or
`app.enableShutdownHooks()` for Nest. The CLI handles SIGINT/SIGTERM. Graceful
shutdown flushes debounced stores; the server's sync acknowledgement alone
does not mean the snapshot is on disk.

```bash
pnpm --filter example-collab-server smoke
```

Smoke builds the example and exercises scoped auth, relay and cold snapshot
reload in standalone, embedded and split modes, including SIGTERM for split.
