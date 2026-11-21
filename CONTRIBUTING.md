# Contributing to Inkio

This is the maintainer guide: repository layout, internal conventions, verification and releases. User-facing documentation lives on the [docs site](https://rascalab.github.io/inkio/).

## Setup

Use Node.js 24 for repository development and tests. CI also checks packed consumers on the minimum supported Node.js version, 22.12. The pnpm version is pinned in the root `packageManager` field.

```bash
pnpm install
pnpm verify
```

## Layout

```text
packages/
  core/         # low-level foundation
  advanced/     # notion-like and integration-heavy extensions
  simple/       # classic WYSIWYG entry point
  editor/       # notion-like entry point
  image-editor/ # optional image editing UI
  collab/       # Yjs-based realtime collaboration client
docs/           # documentation site (Nextra)
examples/       # basic-react, next-app-router, collab-server
e2e/            # Playwright specs against the built examples
```

Package roles:

- `@inkio/core`: primitives, menus, icons, markdown, `ImageBlock`, callout, details/toggle, table, keyboard shortcuts
- `@inkio/advanced`: slash command, block handle, mention, hashtag, wiki link, bookmark, comment
- `@inkio/simple`: core-only classic editor
- `@inkio/editor`: notion-like editor that includes `advanced`
- `@inkio/image-editor`: canvas image editor, usable on its own
- `@inkio/collab`: Yjs realtime collaboration client (no server; wire protocol and transport only)

## Shared chrome contract

Each package keeps its own layout:

- `simple`: classic, toolbar first
- `editor`: notion-like
- `image-editor`: fullscreen overlay

The visual system is shared through common surface tokens:

- `surface-shell`: toolbar, dock, command bar, sidebar
- `surface-panel`: popover, bubble menu, floating card, picker
- `surface-field`: input, select, textarea, search, segmented control

Focus rings, borders, blur, shadows and field styling follow this shared contract wherever possible.

## Dependency policy

- Peers are `react` and `react-dom`. `@inkio/collab` and `@inkio/image-editor` also peer on `@inkio/core`, so they share the app's single copy.
- The Tiptap runtime Inkio uses goes in each package's `dependencies`; apps never install `@tiptap/*` themselves.
- Keep Tiptap package versions aligned. The stack includes peers that require the exact same Tiptap release.
- `@inkio/core` is published, but the docs do not present it as a starting point for apps.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm examples:build
pnpm e2e
pnpm collab:smoke
pnpm security:audit
pnpm release:smoke
```

`pnpm verify` is the quick subset and includes the reference collaboration server smoke. `pnpm verify:full` also audits the lockfile, runs Chromium and Firefox E2E and WebKit workbench E2E, and checks package exports and bundle budgets. Package smoke installs tarballs with strict peers on React 19.3 and checks the non-image editor packages on React 18.

## Releasing

The root, the six packages and `docs` all share one version.

```bash
pnpm release:version 0.0.8   # set the version in all eight package.json files
# add a "## [0.0.8] - YYYY-MM-DD" entry to CHANGELOG.md, then commit and push main
git tag v0.0.8
git push origin v0.0.8
```

Pushing the tag runs `Publish Packages`:

1. Checks that every `package.json` matches the tag version.
2. Checks that the tagged commit is on main and that its CI run succeeded (waits if CI is still running).
3. Builds the packages and runs publint, attw, budgets and the release smoke test.
4. Publishes through npm trusted publishing (OIDC) with provenance; no npm token is involved.
5. If publishing succeeded, `Deploy Docs` deploys the docs site from the same commit.

Pushing to main does not deploy the docs site. To ship a docs-only fix between releases, run `Deploy Docs` manually from the Actions tab; it deploys the selected branch as is, so check that it documents nothing unreleased.

The latest guide is unversioned; release snapshots live at `/versions/vX.Y.Z/`
and are generated from each release tag's `docs/content` during `docs:build`
and docs dev. Fetch release tags (`git fetch --tags`) before building. Do not
edit the generated files. Snapshots keep the tagged guide text and code
examples, but do not run old interactive playgrounds on the current SDK.

## Open work: extension adapter

Third-party `@tiptap/*` extensions are currently passed raw through `extensions`, and version conflicts are the user's problem (BlockNote wraps them with a `createExtension` adapter). A `defineExtension`-style adapter is tracked as a separate goal. When it lands, delete this section and the extension compatibility table in the docs.
