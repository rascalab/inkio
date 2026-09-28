# CLAUDE.md

This file provides repository-specific guidance for coding agents.

## Project Overview

Inkio is a pnpm monorepo with layered editor packages plus docs:

- `@inkio/core`
- `@inkio/advanced`
- `@inkio/simple`
- `@inkio/editor`
- `@inkio/collab` (Hocuspocus/Yjs realtime; server example in `examples/collab-server`)
- `@inkio/image-editor`
- `docs` (Next.js 16 + Nextra v4)

Docs URL: https://rascalab.github.io/inkio/

## Commands

```bash
pnpm dev             # docs dev server
pnpm dev:packages    # watch publishable package builds
pnpm dev:all         # docs + package watch together
pnpm typecheck       # package + docs + example typecheck
pnpm test            # package tests
pnpm build           # package builds + docs static build
pnpm examples:build  # example app builds
pnpm e2e             # Playwright smoke tests
pnpm release:smoke   # packed-tarball install/build smoke test
pnpm verify          # full validation pipeline
pnpm docs:drift      # fail when source moved on without guide updates
```

## Guide maintenance

- Public API, dependency, or build-order change? Update the owning `AGENTS.md` in the same PR.
- Every `AGENTS.md` prohibition should have a matching contract test (see `dependency-contract.test.ts`).
- `pnpm docs:drift --update` resets the drift baseline after an init-deep update.

## Notes

- `docs` is configured for GitHub Pages deployment under `/inkio`.
- `docs` build runs `pagefind` in `postbuild` to generate search indexes.
- `@inkio/core`, `@inkio/advanced`, `@inkio/simple`, `@inkio/editor`, and `@inkio/image-editor` have Vitest coverage.
