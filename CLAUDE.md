# CLAUDE.md

This file provides repository-specific guidance for Claude Code.

## Project Overview

Inkio is a pnpm monorepo with three publishable packages and one docs app:

- `@inkio/editor`
- `@inkio/extension`
- `@inkio/server`
- `docs` (Next.js 16 + Nextra v4)

Docs URL: https://pickst3r.github.io/inkio/

## Commands

```bash
pnpm dev             # docs dev server
pnpm dev:packages    # watch core/extensions package builds
pnpm dev:all         # docs + package watch together
pnpm lint            # package lint scripts + docs typecheck
pnpm test            # package tests
pnpm build           # package builds + docs static build
pnpm docs:typecheck  # docs TypeScript check
pnpm docs:build      # docs static build
```

## Notes

- `docs` is configured for GitHub Pages deployment under `/inkio`.
- `docs` build runs `pagefind` in `postbuild` to generate search indexes.
- `@inkio/editor` and `@inkio/extension` have automated tests with Vitest.
- `@inkio/server` currently has no test files; the test script uses `--passWithNoTests`.
