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

`@inkio/simple`도 SSR 환경에서 초기 문서 HTML을 먼저 렌더하고, hydration 이후에 toolbar-first interactive editor로 이어지는 계약을 사용합니다.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/simple/markdown';
```

The adapter is implemented in `@inkio/core/markdown` with `remark/unified` and re-exported here.
