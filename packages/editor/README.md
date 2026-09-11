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
import { Editor } from '@inkio/editor';
import '@inkio/editor/minimal.css';

export function EditorPage() {
  return (
    <Editor
      initialContent="<p>Hello Inkio</p>"
      hashtagItems={({ query }) => [
        { id: query || 'inkio', label: `#${query || 'inkio'}` },
      ]}
    />
  );
}
```

```tsx
import { useState } from 'react';
import { Editor } from '@inkio/editor';
import { ToC } from '@inkio/core';

export function EditorPage() {
  const [editor, setEditor] = useState(null);
  return (
    <div style={{ position: 'relative' }}>
      <Editor initialContent="<p>Hello Inkio</p>" onCreate={setEditor} />
      <ToC source={editor} maxLevel={4} />
    </div>
  );
}
```

Next App Router에서는 `Editor`를 client component 안에서 사용하되, hard refresh 시에도 초기 문서 HTML은 서버에서 먼저 렌더됩니다. `@inkio/image-editor` 같은 무거운 확장은 lazy component로 넘기는 구성을 권장합니다.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor/markdown';
```

Markdown round-trip is guaranteed for `core` nodes only.
`@inkio/editor` CSS already includes the advanced preset styles it depends on.
