# Inkio AI Context

Use this file when asking an AI assistant to generate or modify Inkio integration code.

## Choose A Starting Point

- `examples/basic-react`
  - Use for: Vite/React, `@inkio/simple`, classic WYSIWYG baseline
- `examples/next-app-router`
  - Use for: Next.js App Router, `@inkio/editor` + `@inkio/advanced` + `@inkio/image-editor`
- `examples/react-router` and `examples/collab-server`
  - Use for: route-based editing, authenticated Yjs collaboration and offline behavior

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
- `@inkio/core`
  - low-level foundation
  - `Editor`, `Viewer`, `getExtensions()`, toolbar/menu primitives
- `@inkio/image-editor`: standalone or modal canvas editor; pair its stylesheet with the core or preset tokens
- `@inkio/collab`: Yjs provider and React hooks; `@inkio/collab/vite` is an optional build-time plugin

For saved `JSONContent`, import `read` from the core or either preset root. Reuse the reader for one immutable document; its `text`, `stats`, `summary()`, `mentions`, `hashTags`, `headings` and `commentIds` match the live editor's document API.

## Installation Rules

- Classic:
  - `npm install @inkio/simple react react-dom`
- Notion-like:
  - `npm install @inkio/editor react react-dom`
- Optional:
  - `npm install @inkio/image-editor "react@^19.3.0" "react-dom@^19.3.0"` for image editing; standalone use also needs `@inkio/core`
  - `npm install @inkio/collab @inkio/core` for realtime editing
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
- Use `@inkio/core` and `@inkio/advanced` only when composing a custom package surface.
- `content` is the initial document only; `initialContent` and controlled mode were removed. Push later changes through the editor instance (`editor.commands.setContent`).
- Next.js App Router should render the editor inside a client component, but the editor now server-prerenders static document HTML before hydration.
- For local workspace development in this repo, docs resolve packages from `packages/*/src`.
- For release validation, use `pnpm release:smoke`.
- Markdown helpers live at:
  - `@inkio/core/markdown`
  - `@inkio/simple/markdown`
  - `@inkio/editor/markdown`
- Use editor JSON for lossless storage. Markdown only preserves supported structures; even core text colors and paragraph alignment can be lost. See the [conversion rules](./docs/content/serialization.mdx).
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
