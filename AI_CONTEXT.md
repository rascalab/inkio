# Inkio AI Context

Use this file when asking an AI assistant to generate or modify Inkio integration code.

## Choose A Starting Point

- `examples/basic-react`
  - Use for: Vite/React, `@inkio/editor` only, smallest editable baseline
- `examples/next-app-router`
  - Use for: Next.js App Router, `@inkio/editor` + `@inkio/extension`, client component integration

## Package Map

- `@inkio/editor`
  - `Editor`, `Viewer`, `BubbleMenu`, `FloatingMenu`, `useInkioEditor`
  - `getDefaultCoreExtensions()`
- `@inkio/extension`
  - `getDefaultInkioExtensions()`
  - Mention, hashtag, slash command, callout, wiki link, image block, equation, bookmark, comment UI
- `@inkio/server`
  - Server-side utilities only

## Installation Rules

- Core only:
  - `npm install @inkio/editor react react-dom`
- Core + extensions:
  - `npm install @inkio/editor @inkio/extension react react-dom`
- Do not manually install these just to use `@inkio/extension`:
  - `@tiptap/*`
  - `katex`
  - `konva`
  - `react-konva`

## CSS Rules

- Core only:
  - import `@inkio/editor/minimal.css` or `@inkio/editor/style.css`
- With extensions:
  - also import `@inkio/extension/style.css`

## Integration Rules

- Prefer `getDefaultCoreExtensions()` or `getDefaultInkioExtensions()` as the starting point.
- `content` and `initialContent` are mutually exclusive.
- Next.js App Router must render the editor in a `use client` component.
- For local workspace development in this repo, docs resolve packages from `packages/*/src`.
- For release validation, use `pnpm release:smoke`.

## Good Prompt Template

Use Inkio in a `<runtime>` app.

- Start from `<example path>`
- Use `<core only | core + extensions>`
- Keep the required CSS imports
- Do not add manual installs for TipTap, KaTeX, Konva, or react-konva
- Add `<feature list>`
- Return code that matches the structure of the example

## Useful Files

- `examples/basic-react/src/App.tsx`
- `examples/next-app-router/components/editor-demo.tsx`
- `docs/content/getting-started.mdx`
- `docs/content/extensions.mdx`
- `docs/content/recipes/basic-react.mdx`
- `docs/content/recipes/next-app-router.mdx`
