# Inkio AI Context

Use this file when asking an AI assistant to generate or modify Inkio integration code.

## Choose A Starting Point

- `examples/basic-react`
  - Use for: Vite/React, `@inkio/simple`, classic WYSIWYG baseline
- `examples/next-app-router`
  - Use for: Next.js App Router, `@inkio/editor` + `@inkio/advanced` + `@inkio/image-editor`

## Package Map

- `@inkio/simple`
  - classic editor entry point
  - `Editor`, `Viewer`, `getDefaultExtensions()`
- `@inkio/editor`
  - notion-like editor entry point
  - `Editor`, `Viewer`, `getDefaultExtensions()`
- `@inkio/advanced`
  - notion-like/integration-heavy extensions
  - slash command, block handle, mention, hashtag, wiki link, bookmark, comment UI
- `@inkio/essential`
  - markdown-friendly document extensions
  - callout, details/toggle, table, keyboard shortcuts
- `@inkio/core`
  - low-level foundation
  - `Editor`, `Viewer`, `getExtensions()`, toolbar/menu primitives
- `@inkio/server`
  - Server-side utilities only

## Installation Rules

- Classic:
  - `npm install @inkio/simple react react-dom`
- Notion-like:
  - `npm install @inkio/editor react react-dom`
- Optional:
  - `npm install @inkio/image-editor`
  - install `@inkio/advanced` only if app code imports advanced exports directly
- Do not manually install `@tiptap/*` just to use Inkio packages. Inkio owns the Tiptap runtime packages it uses.

## CSS Rules

- `@inkio/simple`
  - import `@inkio/simple/minimal.css` or `@inkio/simple/style.css`
- `@inkio/editor`
  - import `@inkio/editor/minimal.css` or `@inkio/editor/style.css`
  - editor CSS already includes advanced preset styles
- With image editor:
  - also import `@inkio/image-editor/style.css`

## Integration Rules

- Prefer package entry points first:
  - `@inkio/simple` for classic editing
  - `@inkio/editor` for notion-like editing
- Use `@inkio/core`, `@inkio/essential`, `@inkio/advanced` only when composing a custom package surface.
- `content` and `initialContent` are mutually exclusive.
- Next.js App Router must render the editor in a `use client` component.
- For local workspace development in this repo, docs resolve packages from `packages/*/src`.
- For release validation, use `pnpm release:smoke`.
- Markdown helpers live at:
  - `@inkio/core/markdown`
  - `@inkio/simple/markdown`
  - `@inkio/editor/markdown`
- Markdown round-trip is guaranteed only for `core + essential` nodes.
- Markdown import/export uses `remark/unified` and direct `JSONContent <-> mdast` mapping.

## Good Prompt Template

Use Inkio in a `<runtime>` app.

- Start from `<example path>`
- Use `<simple | editor>`
- Keep the required CSS imports
- Do not add manual installs for TipTap packages
- Add `<feature list>`
- Return code that matches the structure of the example

## Useful Files

- `examples/basic-react/src/App.tsx`
- `examples/next-app-router/components/editor-demo.tsx`
- `docs/content/getting-started.mdx`
- `docs/content/extensions.mdx`
- `docs/content/recipes/basic-react.mdx`
- `docs/content/recipes/next-app-router.mdx`
