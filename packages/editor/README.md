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

Optional image editing requires React and React DOM 19.3 or later in the 19.x line:

```bash
npm install @inkio/image-editor "react@^19.3.0" "react-dom@^19.3.0"
```

Install `@inkio/advanced` separately only if app code imports advanced exports such as `CommentPanel`.

## Usage

```tsx
import { Editor } from '@inkio/editor';
import '@inkio/editor/style.css';

export function EditorPage() {
  return (
    <Editor
      content="<p>Hello Inkio</p>"
      hashtagItems={({ query }) => [
        { id: query || 'inkio', label: `#${query || 'inkio'}` },
      ]}
    />
  );
}
```

```tsx
import { useState } from 'react';
import { Editor, ToC, type InkioEditor } from '@inkio/editor';

export function EditorPage() {
  const [editor, setEditor] = useState<InkioEditor | null>(null);
  return (
    <div style={{ position: 'relative' }}>
      <Editor content="<h2>Hello Inkio</h2>" onCreate={setEditor} />
      <ToC source={editor} maxLevel={4} />
    </div>
  );
}
```

Next App Router에서는 `Editor`를 client component 안에서 사용하되, hard refresh 시에도 초기 문서 HTML은 서버에서 먼저 렌더됩니다. `@inkio/image-editor` 같은 무거운 확장은 lazy component로 넘기는 구성을 권장합니다.

## Saved JSON

Import `read` from `@inkio/editor` to read saved content without mounting an editor. For example, `const doc = read(json)` gives you `doc.mentions`, `doc.hashTags` and `doc.commentIds` without loading comment threads. Reuse the reader for the same immutable JSON; create another for a changed document.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor/markdown';
```

Use JSON for lossless storage. Markdown preserves supported structures, but drops text colors and turns mentions and hashtags into text.
`@inkio/editor` CSS already includes the advanced preset styles it depends on.
