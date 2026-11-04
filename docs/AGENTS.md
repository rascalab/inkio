# docs AGENTS.md

Score: >15 (32 source files, Nextra app boundary). Parent covers monorepo-wide rules; this file covers the docs app only.

## OVERVIEW
Nextra v4 docs app on Next.js 16, deployed to GitHub Pages under `/inkio`.

## STRUCTURE
```
docs/
├── app/            # routes: page.tsx (landing), (docs)/[...mdxPath]/page.tsx (all content)
├── content/        # *.mdx trees (getting-started, components, extensions, recipes, ...)
├── components/    # LandingPage + doc widgets
└── scripts/        # docs-local helpers
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a doc page | content/ + content/_meta.tsx | nav entry required |
| Landing changes | app/page.tsx + components/LandingPage | — |
| MDX wrapper | mdx-components.tsx | nextra-theme-docs |
| Nav order | content/_meta.tsx | — |

## CONVENTIONS
- Dev/build force webpack: `next dev --webpack` / `next build --webpack` with `INKIO_USE_SOURCE_PACKAGES=1`.
- Typecheck uses `tsconfig.build.json`, not the root tsconfig.
- `postbuild` runs `pagefind` for search indexes; base path `/inkio`.
- Package name is `docs` (private), not `@inkio/docs`.
- Source-package aliases apply only under `INKIO_USE_SOURCE_PACKAGES=1`; build tsconfigs clear `paths` so releases resolve distributions.
- `GITHUB_PAGES=true` switches to `.next-pages` static export with `/inkio` prefix and no image optimization.

## ANTI-PATTERNS
- Do not edit built output; search indexes regenerate via postbuild.
- Do not import `packages/*/src` directly in content; depend on workspace packages.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
