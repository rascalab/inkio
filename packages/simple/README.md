# @inkio/simple

Classic WYSIWYG Inkio entry point.

## Defaults

- based on `@inkio/core`
- toolbar on
- bubble menu off
- floating menu off

## Install

```bash
npm install @inkio/simple react react-dom
```

## Usage

```tsx
import { Editor, Viewer } from '@inkio/simple';
import '@inkio/simple/minimal.css';

export function SimplePage() {
  return <Editor initialContent="<p>Hello Inkio</p>" />;
}
```

## Viewer ToC

```tsx
<Viewer
  content={content}
  tableOfContents
/>
```

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/simple/markdown';
```

The adapter is implemented in `@inkio/core/markdown` with `remark/unified` and re-exported here.
