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

`Editor`는 CSR 앱에서 그대로 사용할 수 있고, Next App Router 같은 SSR 환경에서는 hard refresh 시 static 문서 HTML을 먼저 렌더한 뒤 hydration 후 interactive editor로 전환됩니다.

## Viewer ToC

```tsx
<Viewer
  content={content}
  tableOfContents={{ position: 'right', maxLevel: 3 }}
/>
```

Use `onHeadingsReady` if you want to render your own table of contents UI outside the built-in viewer layout.

`Viewer`는 static HTML 기반이라 SSR/CSR 모두에서 같은 마크업 계약으로 동작합니다.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/core/markdown';
```

Round-trip support is guaranteed for `core + essential` nodes only.
The markdown adapter uses `remark/unified` and maps markdown directly to Inkio `JSONContent`.
