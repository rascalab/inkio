# @inkio/advanced

Notion-like and integration-heavy extensions for Inkio.

## Includes

- slash command
- block handle
- mention
- hashtag
- wiki link
- bookmark
- comment mark and comment UI

## Public entry points

- `getDefaultExtensions(options?)` returns the core editing extensions **plus** the advanced ones. Use it as a replacement list when composing with core.
- `getAdvancedViewerExtensions(comment?)` returns **only** the advanced read-only additions. Add them to a core viewer's defaults to render saved advanced nodes and marks.
- Individual extensions are available at `@inkio/advanced/block-handle`, `/bookmark`, `/comment`, `/hashtag`, `/mention`, `/slash-command`, and `/wikilink`.
- `Comment`, `CommentPanel`, `CommentComposer`, and `CommentThreadPopover` are available from the root and the `/comment` entry. `getDefaultExtensions({ comment })` takes `CommentConfig`; `Comment.configure(toCommentOptions(comment))` adapts that config for direct use.
- `applyExtensionsAdapter`, `mapExtensionsAdapterToOptions`, `isExtensionsAdapter`, and the `ExtensionsAdapter` type are low-level root exports. Neither editor preset accepts an `adapter` prop.
- `@inkio/advanced/style.css` (extension styles; load after core or simple CSS)

To read mentions, hashtags or comment IDs from saved JSON, use `read` from `@inkio/core` or either preset root. It does not require the advanced extensions.

## Install

```bash
npm install @inkio/core @inkio/advanced react react-dom
```

Install this directly only if you are composing with `@inkio/core` or importing advanced exports such as `CommentPanel`. `@inkio/editor` already depends on `@inkio/advanced`.

## Usage

```tsx
import { useMemo, useState } from 'react';
import { Editor, type TiptapEditor } from '@inkio/core';
import { CommentPanel, getDefaultExtensions, type CommentConfig, type CommentData } from '@inkio/advanced';
import '@inkio/core/style.css';
import '@inkio/advanced/style.css';

export function AdvancedEditor({ comment, threads }: { comment: CommentConfig; threads: CommentData[] }) {
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const extensions = useMemo(() => getDefaultExtensions({ comment }), [comment]);

  return (
    <>
      <Editor content="<p>Hello Inkio</p>" extensions={{ items: extensions, replace: true }} onCreate={setEditor} />
      <CommentPanel editor={editor} threads={threads} />
    </>
  );
}
```

The panel uses the reply, resolve, and delete handlers registered in `comment`. Pass `false` to hide an action in this panel (e.g. `onDelete={false}`), or pass a function to replace its handler. Supply only threads authorized for the current document and user; the server must authorize each mutation.

`@inkio/editor/style.css` already includes these styles. Do not import both.
