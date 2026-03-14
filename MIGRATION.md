# Migration

This release changes the package layout.

## Removed Packages

- `@inkio/extension`
- `@inkio/comment`

Their responsibilities moved into:

- `@inkio/essential`
- `@inkio/advanced`

## New Entry Points

- use `@inkio/simple` for a classic WYSIWYG editor
- use `@inkio/editor` for the notion-like opinionated editor

`@inkio/core` is the shared foundation package. It is published, but most app consumers should not start there.

## Package Mapping

- old `@inkio/editor` low-level imports
  - move to `@inkio/core` if you were consuming primitives directly
- old `@inkio/extension` preset usage
  - move to `@inkio/editor` or `@inkio/advanced`
- old `@inkio/comment`
  - move to `@inkio/advanced`

## API Naming

- `@inkio/core`
  - `getExtensions(options?)`
- `@inkio/essential`
  - `getDefaultExtensions(options?)`
- `@inkio/advanced`
  - `getDefaultExtensions(options?)`
- `@inkio/simple`
  - `getDefaultExtensions(options?)`
- `@inkio/editor`
  - `getDefaultExtensions(options?)`

## Import Examples

Before:

```tsx
import { Editor, getDefaultCoreExtensions } from '@inkio/editor';
import { SlashCommand, WikiLink } from '@inkio/extension';
import { Comment, CommentPanel } from '@inkio/comment';
import '@inkio/extension/style.css';
import '@inkio/comment/style.css';
```

After:

```tsx
import { Editor } from '@inkio/editor';
import { CommentPanel } from '@inkio/advanced';
import '@inkio/editor/minimal.css';
import '@inkio/advanced/style.css';
```

Or, for classic editing:

```tsx
import { Editor } from '@inkio/simple';
import '@inkio/simple/minimal.css';
```

## Comments

Before:

```tsx
import { Comment, CommentPanel } from '@inkio/comment';
```

After:

```tsx
import { Comment, CommentPanel } from '@inkio/advanced';
```

## Markdown

Before:

- no supported markdown package

After:

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor/markdown';
```

Markdown round-trip is guaranteed only for `core + essential` nodes.
The current markdown implementation uses `remark/unified` and direct `JSONContent <-> mdast` mapping.

## Styles

Before:

```tsx
import '@inkio/editor/minimal.css';
import '@inkio/extension/style.css';
import '@inkio/comment/style.css';
```

After:

```tsx
import '@inkio/editor/minimal.css';
import '@inkio/advanced/style.css';
import '@inkio/image-editor/style.css';
```

For `@inkio/simple`, use:

```tsx
import '@inkio/simple/minimal.css';
```

## Notes

- `react` and `react-dom` remain peers.
- Inkio owns the Tiptap runtime packages it uses.
- `justify` alignment is unsupported.
- first-party math support was removed. Use [Tiptap Mathematics](https://tiptap.dev/docs/editor/extensions/nodes/mathematics) directly.
