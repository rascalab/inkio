# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-27
**Commit:** 47357cf
**Branch:** main

## OVERVIEW
Inkio is a pnpm monorepo of layered Tiptap-based React editors: `@inkio/core` foundation, `@inkio/advanced` collaboration extensions, `@inkio/simple` / `@inkio/editor` presets, `@inkio/collab` realtime Yjs layer, `@inkio/image-editor` canvas editor, plus Nextra docs.

## STRUCTURE
```
./
├── packages/core/          # foundation primitives, all presets build on this
├── packages/advanced/      # per-extension entries under src/entries/
├── packages/simple/        # classic WYSIWYG preset (wraps core)
├── packages/editor/        # notion-like preset (wraps core+advanced)
├── packages/collab/        # Hocuspocus/Yjs realtime layer (`@inkio/collab`, single `.` subpath)
├── packages/image-editor/  # konva canvas editor, standalone
├── docs/                   # Nextra app, workspace member named `docs`
├── examples/               # basic-react (vite) + next-app-router + collab-server (Nest/Hocuspocus)
├── e2e/                    # Playwright specs on built examples
└── scripts/                # vite build runner + publint/attw/budget gates
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Core UI (Editor/Viewer/menus/hooks) | packages/core/src/ | see packages/core/AGENTS.md |
| Collaboration (mention/comment/slash) | packages/advanced/src/ | see packages/advanced/AGENTS.md |
| Canvas editing | packages/image-editor/src/ | see packages/image-editor/AGENTS.md |
| Realtime collab | packages/collab/src/ | see packages/collab/AGENTS.md; server side lives in examples/collab-server/ |
| Docs content/routes | docs/content/, docs/app/ | see docs/AGENTS.md |
| Classic preset entry | packages/simple/src/index.ts | re-exports core; own getDefaultExtensions |
| Notion preset entry | packages/editor/src/index.ts | re-exports core + advanced comment types |
| E2E specs/config | e2e/, playwright.config.ts | chromium+firefox, ports 4173/4174 |
| Release gates | scripts/check-attw.mjs, check-budgets.mjs, release-smoke.mjs | run via root scripts, never directly |

## CODE MAP
Centrality unmeasured (typescript-language-server not installed); map is export-based, verified by file reads.

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| Editor/Viewer/StaticViewer | component | packages/core/src/index.ts | core surfaces; simple/editor re-export own copies |
| useInkioEditor | hook | packages/core/src/hooks/use-inkio-editor.ts | editor instantiation |
| getExtensions | function | packages/core/src/extensions/get-extensions.ts | core assembly; presets expose getDefaultExtensions instead |
| InkioProvider/useInkioContext | context | packages/core/src/context/InkioProvider.tsx | optional shared context |
| toPlainText/toSummary/getContentStats | function | packages/core/src/serialization.ts | content stats |
| createMarkdownAdapter | function | packages/core/src/markdown/ (`@inkio/core/markdown`) | markdown kept out of main bundle |
| BlockHandle/Bookmark/Mention/HashTag/SlashCommand/WikiLink | extension | packages/advanced/src/ | one subpath per extension via src/entries/ |
| Comment/CommentComposer/CommentPanel | component | packages/advanced/src/comment/ | comment bundle |
| createCollabProvider/useInkioCollaborativeEditor | collab | packages/collab/src/ | Hocuspocus provider + hooks; no socket.io |
| ImageEditor/ImageEditorModal | component | packages/image-editor/src/index.ts | canvas editor entry |

## CONVENTIONS
- Import via package subpaths (`@inkio/core/markdown`, `@inkio/advanced/comment`), never deep `src/` paths.
- `getExtensions` (core) vs `getDefaultExtensions` (every other package) — different names, same role.
- CSS contract: `minimal.css` vs `style.css` per package (`style` = full); editor CSS already covers advanced; image-editor needs its own `style.css`.
- `content` is the initial document only (no `initialContent`, no controlled mode); push later changes through the editor instance.
- Build order matters: core → advanced → simple/editor/image-editor → collab (`pnpm build:packages` encodes it).
- Env flags: `INKIO_USE_SOURCE_PACKAGES=1` (docs/examples resolve `packages/*/src`), `INKIO_VITE_SKIP_DTS=1` (fast smoke builds).

## ANTI-PATTERNS (THIS PROJECT)
- Never install `@tiptap/*` directly; Inkio owns its Tiptap runtime.
- Never start apps from `@inkio/core`; use `@inkio/simple` (classic) or `@inkio/editor` (notion-like).
- Never install `@inkio/advanced` unless app code imports advanced exports directly.
- `@inkio/extension` and `@inkio/comment` are dead ends (removed); use `@inkio/editor` / `@inkio/advanced`.
- Markdown round-trip holds for core nodes only; advanced nodes may not survive.
- Editor must live inside a client component under Next.js App Router (server-prerenders static HTML first).

## UNIQUE STYLES
- `packages/advanced/src/entries/` barrel-per-extension is the subpath mechanism (7 subpaths).
- Vite build: dts excludes tests, copy-css inlines `@import` chains, dual es (`.js`) + cjs (`.cjs`) outputs.
- TS strict + `noUnusedLocals`/`noUnusedParameters` + `allowImportingTsExtensions` + `@/*` → `./src/*` alias per package.
- Mixed filename casing is normal here: PascalCase nodes (`Callout.ts`) beside kebab-case plugins (`block-drag-plugin.ts`).

## COMMANDS
```bash
pnpm typecheck          # all pkgs + docs + examples (lint alias)
pnpm test               # vitest run across 6 pkgs
pnpm build              # build:packages + docs:build
pnpm verify             # typecheck + test + smoke builds + examples smoke
pnpm e2e                # playwright chromium on built examples
pnpm release:smoke      # packed-tarball install/build smoke
pnpm release:version X  # set root + 6 pkgs + docs to version X in lockstep
pnpm dev:packages       # vite build --watch per publishable pkg
```

## NOTES
- `pnpm-workspace.yaml` lists members explicitly; adding a package means editing it.
- `packages/collab` is covered (see packages/collab/AGENTS.md); its server counterpart is `examples/collab-server` (CommonJS, Node >= 22, Nest/Hocuspocus).
- Release: `pnpm release:version X`, add the CHANGELOG entry, push main, push tag `vX`. `publish-packages.yml` fails unless the tag matches every manifest and the commit's main CI passed, then rebuilds, gates and publishes via npm OIDC (no token).
- `docs` is version-synced with the packages and deployed under `/inkio` (GitHub Pages); docs build runs `pagefind` postbuild.
- `image-editor` is the inconsistent package: no `LICENSE`, no `vitest.config.ts`.
- Zero `DO NOT/NEVER` hits in `packages/*/src`; guardrails live in `AI_CONTEXT.md` / `MIGRATION.md`.
