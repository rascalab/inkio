# @inkio/editor

Opinionated notion-like Inkio entry point.

## Defaults

- based on `@inkio/advanced`
- bubble menu on
- floating menu on
- toolbar off
- block handle on
- slash command on

## Install

```bash
npm install @inkio/editor react react-dom
```

Optional:

```bash
npm install @inkio/image-editor
```

Install `@inkio/advanced` separately only if app code imports advanced exports such as `CommentPanel`.

## Usage

```tsx
import { Editor, Viewer } from '@inkio/editor';
import '@inkio/editor/minimal.css';

export function EditorPage() {
  return (
    <Editor
      initialContent="<p>Hello Inkio</p>"
      defaultExtensionsOptions={{
        hashtagItems: ({ query }) => [
          { id: query || 'inkio', label: `#${query || 'inkio'}` },
        ],
      }}
      showBubbleMenu
      showFloatingMenu
    />
  );
}
```

```tsx
<Viewer
  content={content}
  tableOfContents={{ position: 'left', maxLevel: 4 }}
/>
```

Next App Router에서는 `Editor`를 client component 안에서 사용하되, hard refresh 시에도 초기 문서 HTML은 서버에서 먼저 렌더됩니다. `@inkio/image-editor` 같은 무거운 확장은 lazy component로 넘기는 구성을 권장합니다.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor/markdown';
```

Markdown round-trip is guaranteed for `core + essential` nodes only.
`@inkio/editor` CSS already includes the advanced preset styles it depends on.
