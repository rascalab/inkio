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
- `read(json): InkioDocument` — read text, stats, summaries, mentions, hashtags, headings and referenced comment IDs without an editor or I/O. Treat the JSON as immutable; create a new reader when it changes.
- `ImageBlock`
- `@inkio/core/icons`
- `@inkio/core/markdown`
- `@inkio/core/static`
- `@inkio/core/ui` — shared provider, locale and overlay utilities without the Tiptap runtime. Its `InkioProvider` is the same provider exported by `@inkio/core`.

## Install

```bash
npm install @inkio/core react react-dom
```

## Usage

```tsx
import { Editor } from '@inkio/core';
import '@inkio/core/style.css';

export function CoreEditor() {
  return (
    <Editor
      content="<p>Hello Inkio</p>"
      placeholder="Start typing..."
      showToolbar
    />
  );
}
```

`Editor`는 CSR 앱에서 그대로 사용할 수 있고, Next App Router 같은 SSR 환경에서는 hard refresh 시 static 문서 HTML을 먼저 렌더한 뒤 hydration 후 interactive editor로 전환됩니다.

## Editor ToC

```tsx
import { useState } from 'react';
import { Editor, ToC, type TiptapEditor } from '@inkio/core';

export function Page() {
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  return (
    <div style={{ position: 'relative' }}>
      <Editor content="<h2>Hello</h2>" onCreate={setEditor} />
      <ToC source={editor} maxLevel={3} />
    </div>
  );
}
```

`Viewer`는 static HTML 기반이라 SSR/CSR 모두에서 같은 마크업 계약으로 동작합니다.

## Markdown

Register the `Markdown` extension to read or replace Markdown on the editor instance. As in the presets, an array adds to core's default extensions. To use an exact schema instead, pass `extensions={{ items: yourExtensions, replace: true }}`.

```tsx
import { Editor } from '@inkio/core';
import { Markdown } from '@inkio/core/markdown';

<Editor
  extensions={[Markdown]}
  onCreate={(editor) => {
    editor.markdown = '## Hello';
    console.log(editor.markdown);
  }}
/>
```

Assignment throws if the input cannot be applied. Rejected writes leave the previous document intact.

Use JSON for lossless storage. Markdown preserves supported structures, not every core mark or attribute (for example, text colors are lost).
The markdown adapter uses `remark/unified` and maps markdown directly to Inkio `JSONContent`.
