# packages/advanced AGENTS.md

Score: >15 (53 files, 10 subdirs, collaboration boundary). Parent covers monorepo-wide rules; this file covers advanced extensions only.

## OVERVIEW
Collaboration and notion-style extensions on top of core: mention, hashtag, slash-command, wikilink, bookmark, block-handle, comment.

## STRUCTURE
```
src/
├── entries/      # one barrel per subpath (block-handle, bookmark, comment, hashtag, mention, slash-command, wikilink)
├── extensions/   # BlockHandle, Bookmark, Mention, HashTag, SlashCommand, WikiLink implementations
├── comment/      # Comment bundle (composer, panel, popover, plugin keys)
└── adapter.ts    # ExtensionsAdapter mapping
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a subpath extension | src/entries/<name>.ts + src/extensions/<Name>/ | barrel + implementation pair |
| Comment UI changes | src/comment/ | composer/panel/popover share plugin keys |
| Mention/hashtag extraction | src/serialization.ts | extractMentions/extractHashtags |
| Preset assembly | src/get-default-extensions.ts | preset entry point |

## CONVENTIONS
- Vite: 8 source entries, dual ESM (`.js`) + CJS (`.cjs`); dts excludes tests; atomic `.dist-build` → `dist` swap.
- Every extension ships as its own subpath (`@inkio/advanced/comment`), not just the main entry.
- `getDefaultExtensions` here (vs core `getExtensions`); `editor` preset consumes this package.
- Tests use `vitest run --passWithNoTests` in this package.

## ANTI-PATTERNS
- Do not import advanced in `simple` preset; only `editor` preset depends on it.
- Do not assume advanced nodes survive markdown round-trip (core-only guarantee).
- Preserve read-only behavior: no composer/transaction/handle/block-menu in read-only surfaces; reject stale async suggestion responses.
