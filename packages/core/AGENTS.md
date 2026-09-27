# packages/core AGENTS.md

Score: >15 (109 files, 25 subdirs, foundation boundary). Parent covers monorepo-wide rules; this file covers core internals only.

## OVERVIEW
Foundation primitives every preset builds on: editor surfaces, menus, hooks, extensions assembly, i18n, overlay, SSR.

## STRUCTURE
```
src/
├── components/   # Editor, Viewer, StaticViewer, menus, ToC, SuggestionList
├── extensions/   # get-extensions assembly + Callout, ImageBlock, TocBlock
├── hooks/        # use-inkio-editor
├── context/      # InkioProvider
├── i18n/         # core locale messages
├── markdown/     # separate `@inkio/core/markdown` entry (unified/remark)
├── ssr/          # separate `@inkio/core/static` entry
├── overlay/      # positioning for menus/popovers
└── utils/        # url-safety, extensions-input, stable-options
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a menu action | src/components/toolbar-actions.ts | defaults + transforms live here |
| Add a core extension | src/extensions/ | wire through get-extensions.ts |
| Editor lifecycle | src/hooks/use-inkio-editor.ts | single instantiation point |
| Option identity | src/utils/stable-options.ts | useStableOptions/useStableCallback; tiptap compares extensions by identity |
| Overlay positioning | src/overlay/positioning.ts | placement math for menus/popovers |
| Static prerender | src/ssr/render-static-content.ts | App Router hydration path |

## CONVENTIONS
- Markdown stays behind `@inkio/core/markdown` so unified/remark never enters the editor bundle.
- Subpaths: `.` `./icons` `./markdown` `./static` `./style.css` `./minimal.css`.
- Tests co-located: `src/__tests__/` + `src/**/__tests__/` + `*.test.ts(x)`; jsdom + `src/test-setup.ts`.
- Inline option literals go through `useStableOptions`/`useStableCallback` (structural compare) — enforced by churn tests.
- Dependency layering is contract-tested (`dependency-contract.test.ts`): React is the only peer; no `@tiptap/*` in peers; no marked/turndown in core.
- CSS tokens live in `tokens.css`; `surface-contract.test.ts` pins style snippets to them.

## ANTI-PATTERNS
- Do not re-export markdown from the main entry; import `@inkio/core/markdown` explicitly.
- Do not bypass `resolveInkioExtensions` when assembling extensions.
- Sanitize URLs via `utils/url-safety`; never raw `href`.
- Never stringify an unsafe href back into markdown link syntax; always sanitize SSR output, never let invalid content crash.
