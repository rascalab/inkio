# Inkio

Inkio is a layered React rich-text editor family built on Tiptap.

## Packages

- `@inkio/editor`
  - notion-like, opinionated, production-ready entry point
  - depends on `@inkio/advanced`
- `@inkio/simple`
  - classic WYSIWYG entry point
  - toolbar-first, core-only default surface
- `@inkio/advanced`
  - advanced extensions: slash command, block handle, mention, hashtag, wiki link, bookmark, comment UI
  - includes `@inkio/essential`
- `@inkio/essential`
  - markdown-friendly document extensions: callout, details/toggle support, table support, keyboard shortcuts
- `@inkio/image-editor`
  - optional image editing UI for `ImageBlock`
- `@inkio/core`
  - low-level foundation package used internally by the higher-level packages
  - published, but not the recommended starting point for app developers

## Install

Classic editor:

```bash
npm install @inkio/simple react react-dom
```

Notion-like editor:

```bash
npm install @inkio/editor react react-dom
```

Optional packages:

```bash
npm install @inkio/image-editor
```

If app code imports `CommentPanel`, comment i18n, or other advanced exports directly:

```bash
npm install @inkio/advanced
```

Inkio owns the Tiptap runtime packages it uses. Normal consumers only need to install the Inkio package they use plus the React peers.

## Quick Start

Simple:

```tsx
import { Editor } from '@inkio/simple';
import '@inkio/simple/minimal.css';

export function SimplePage() {
  return <Editor initialContent="<p>Hello Inkio</p>" />;
}
```

Editor:

```tsx
import { Editor } from '@inkio/editor';
import '@inkio/editor/style.css';

export function EditorPage() {
  return (
    <Editor
      initialContent="<p>Hello Inkio</p>"
      hashtagItems={({ query }) => [
        { id: query || 'inkio', label: `#${query || 'inkio'}` },
      ]}
      ui={{ showBubbleMenu: true, showFloatingMenu: true }}
    />
  );
}
```

Image editor:

```tsx
import { Editor } from '@inkio/editor';
import { ImageEditorModal } from '@inkio/image-editor';
import '@inkio/editor/style.css';
import '@inkio/image-editor/style.css';

export function EditorWithImages() {
  return (
    <Editor
      onImageUpload={async (file) => URL.createObjectURL(file)}
      imageBlock={{ imageEditor: ImageEditorModal }}
    />
  );
}
```

## Markdown

Markdown lives in the package subpaths:

- `@inkio/simple/markdown`
- `@inkio/editor/markdown`
- `@inkio/core/markdown`

Supported round-trip scope is `core + essential`. Advanced-only nodes degrade to plain text or HTML fallback.

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/simple/markdown';

const initialContent = parseMarkdown('## Hello\\n\\n- one\\n- two');
const markdown = stringifyMarkdown(initialContent);
```

`@inkio/core/markdown` is implemented with `remark/unified` and maps markdown directly to `JSONContent`.

## Notes

- `@inkio/editor` defaults to notion-like UI:
  - bubble menu on
  - floating menu on
  - toolbar off
  - slash command on
  - block handle on
- `@inkio/editor/minimal.css` and `@inkio/editor/style.css` already include advanced preset styles.
- `@inkio/simple` defaults to classic UI:
  - toolbar on
  - bubble/floating off
- `justify` text alignment is intentionally unsupported.
- first-party math support was removed. Use [Tiptap Mathematics](https://tiptap.dev/docs/editor/extensions/nodes/mathematics) directly if needed.

## Development

```bash
pnpm install
pnpm verify
```

Key examples:

- `examples/basic-react` -> `@inkio/simple`
- `examples/next-app-router` -> `@inkio/editor`
