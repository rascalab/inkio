# packages/image-editor AGENTS.md

Score: >15 (93 files, 14 subdirs, standalone canvas boundary). Parent covers monorepo-wide rules; this file covers the canvas editor only.

## OVERVIEW
Standalone konva-based image editor: modal + canvas + toolbar, no Tiptap dependency.

## STRUCTURE
```
src/
├── toolbar/options/  # per-tool panels (Filter, Sticker, Redact, Shape, ...)
├── canvas/           # rendering surface
├── utils/            # image helpers
├── reducer.ts        # editor state machine
├── types.ts          # Annotation union, Transform, ToolType
└── i18n/             # image-editor locale messages
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a tool | src/types.ts (ToolType) + src/toolbar/options/ | type + panel pair |
| Canvas behavior | src/canvas/ | konva/react-konva |
| State transitions | src/reducer.ts | single state machine (37 case arms) |
| Canvas export | src/utils/export-canvas.ts | snapshot-invariant: spread values, never mutate |
| Strings | src/i18n/ | merge/resolve helpers mirror core pattern |

## CONVENTIONS
- Only subpath is `./style.css`; no icons/markdown/static split.
- Own i18n helpers (`mergeImageEditorMessages`, `resolveImageEditorMessages`); same shape as core, separate bundle.
- Deps differ from text packages: konva, react-konva, radix.
- Keyboard shortcuts must not steal keys from text inputs, selects, or rich-text surfaces.

## ANTI-PATTERNS
- Do not mix Tiptap extension patterns in here; state flows through the reducer.
- Package ships no `LICENSE` / `vitest.config.ts` — do not assume per-package file parity.
