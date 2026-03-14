# @inkio/advanced

Notion-like and integration-heavy extensions for Inkio. Includes `@inkio/essential`.

## Includes

- slash command
- block handle
- mention
- hashtag
- wiki link
- bookmark
- comment mark and comment UI

## Exports

- `getDefaultExtensions(options?)`
- `Comment`
- `CommentPanel`
- `CommentComposer`
- `CommentThreadPopover`
- `extractMentions`
- `extractHashtags`
- `@inkio/advanced/style.css`

## Install

```bash
npm install @inkio/advanced react react-dom
```

Install this directly only if you are composing with `@inkio/core` or importing advanced exports such as `CommentPanel`. `@inkio/editor` already depends on `@inkio/advanced`.

## Usage

```tsx
import { Editor } from '@inkio/core';
import { CommentPanel, getDefaultExtensions } from '@inkio/advanced';
import '@inkio/core/minimal.css';
import '@inkio/advanced/style.css';

export function AdvancedEditor() {
  const extensions = getDefaultExtensions({
    hashtagItems: ({ query }) => [{ id: query || 'inkio', label: `#${query || 'inkio'}` }],
  });

  return (
    <>
      <Editor initialContent="<p>Hello Inkio</p>" extensions={extensions} />
      <CommentPanel editor={null} threads={[]} currentUser="You" onReply={() => {}} onResolve={() => {}} onDelete={() => {}} />
    </>
  );
}
```
