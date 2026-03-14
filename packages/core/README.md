# @inkio/core

Low-level Inkio foundation package.

Most app developers should start with `@inkio/simple` or `@inkio/editor` instead.

## Exports

- `Editor`
- `Viewer`
- `Toolbar`
- `BubbleMenu`
- `FloatingMenu`
- `TableMenu`
- `getExtensions(options?)`
- `ImageBlock`
- `@inkio/core/icons`
- `@inkio/core/markdown`

## Install

```bash
npm install @inkio/core react react-dom
```

## Usage

```tsx
import { Editor, Viewer, getExtensions } from '@inkio/core';
import '@inkio/core/minimal.css';

export function CoreEditor() {
  return (
    <Editor
      initialContent="<p>Hello Inkio</p>"
      extensions={getExtensions({ placeholder: 'Start typing...' })}
      showToolbar
    />
  );
}
```

## Viewer ToC

```tsx
<Viewer
  content={content}
  tableOfContents={{ position: 'right', maxLevel: 3 }}
/>
```

Use `onHeadingsReady` if you want to render your own table of contents UI outside the built-in viewer layout.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/core/markdown';
```

Round-trip support is guaranteed for `core + essential` nodes only.
The markdown adapter uses `remark/unified` and maps markdown directly to Inkio `JSONContent`.
