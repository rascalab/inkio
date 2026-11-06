# Migration

## 0.0.7 → 0.0.8

No API is removed. These changes in behavior may need a look:

- **Tab writes.** Tab nests a list item, indents code, moves between table cells and otherwise types a tab; Escape leaves the editor. To keep browser focus navigation, pass `tabBehavior="default"` to `Editor` in `@inkio/editor` or `@inkio/simple`.
- **`Viewer` follows `content`.** `Viewer` in `@inkio/editor` and `@inkio/simple` re-renders when `content` changes. If you remounted it with a `key` to show a new document, the `key` is no longer needed.
- **A single tilde is text.** Markdown import reads `~gone~` literally. Use `~~gone~~` for strikethrough.
- **Comment threads of deleted text leave `CommentPanel`.** `onDelete` is not called for them, so clear your store on save:

  ```ts
  import { getCommentIds } from '@inkio/editor';

  const keep = new Set(getCommentIds(editor.getJSON()));
  // delete stored threads whose id is not in `keep`
  ```

- **Changing `locale` keeps the editor.** `Editor` updates its words in place and keeps the caret and undo history. With `useInkioEditor`, which has no `locale` prop to watch, call `setEditorUi(editor, { locale })`.

## 0.0.6 → 0.0.7

### `content` is initial-only

`initialContent` is removed, and `content` no longer acts as a controlled value. The editor reads `content` once at mount and owns the document afterwards; `onUpdate` still reports every change.

Before:

```tsx
<Editor initialContent={doc} />
// or the controlled form
<Editor content={doc} onUpdate={setDoc} />
```

After:

```tsx
<Editor content={doc} onUpdate={setDoc} />
```

To replace the document after mount (for example when loading another record), use the editor instance from `onCreate`:

```tsx
const editorRef = useRef<TiptapEditor | null>(null);

<Editor content={doc} onCreate={(editor) => { editorRef.current = editor; }} />;

editorRef.current?.commands.setContent(nextDoc);
```

### Markdown helpers come from `/markdown`

`parseMarkdown`, `stringifyMarkdown` and `createMarkdownAdapter` are no longer exported from the package roots.

Before:

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor';
```

After:

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor/markdown';
```

The same applies to `@inkio/simple/markdown` and `@inkio/core/markdown`.

### Dark mode uses a class

- `data-theme="dark"` on `.inkio` is no longer read. Pass `theme="dark"` to `Editor` / `Viewer`, or keep a `.dark` (or `.dark-theme`) class on an ancestor, such as the class strategy of next-themes or Tailwind.
- `data-theme="auto"` is gone. To follow the OS setting, derive `theme` from `window.matchMedia('(prefers-color-scheme: dark)')`.

### Smaller removals

- `TableOfContentsConfig` (`@inkio/core`): type the `ToC` component with `ToCProps`.
- `@inkio/editor` `Viewer`: replace `comment={false}` by omitting `comment`.

### Stricter types

0.0.6 shipped declarations in which many props resolved to `any`. 0.0.7 ships complete declarations, so TypeScript may report errors in code that compiled before; those errors point at real type mismatches.

### New optional package

`@inkio/collab` adds Yjs real-time collaboration over Hocuspocus. Existing apps need no change; see `packages/collab/README.md` to adopt it.

## 0.0.5: package layout

The 0.0.5 release changed the package layout.

### Removed Packages

- `@inkio/extension`
- `@inkio/comment`

Their responsibilities moved into:

- `@inkio/core`
- `@inkio/advanced`

### New Entry Points

- use `@inkio/simple` for a classic WYSIWYG editor
- use `@inkio/editor` for the notion-like opinionated editor

`@inkio/core` is the shared foundation package. It is published, but most app consumers should not start there.

### Package Mapping

- old `@inkio/editor` low-level imports
  - move to `@inkio/core` if you were consuming primitives directly
- old `@inkio/extension` preset usage
  - move to `@inkio/editor` or `@inkio/advanced`
- old `@inkio/comment`
  - move to `@inkio/advanced`

### API Naming

- `@inkio/core`
  - `getExtensions(options?)`
- `@inkio/advanced`
  - `getDefaultExtensions(options?)`
- `@inkio/simple`
  - `getDefaultExtensions(options?)`
- `@inkio/editor`
  - `getDefaultExtensions(options?)`

### Import Examples

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

### Comments

Before:

```tsx
import { Comment, CommentPanel } from '@inkio/comment';
```

After:

```tsx
import { Comment, CommentPanel } from '@inkio/advanced';
```

### Markdown

Before:

- no supported markdown package

After:

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/editor/markdown';
```

Markdown round-trip is guaranteed only for `core` nodes.
The current markdown implementation uses `remark/unified` and direct `JSONContent <-> mdast` mapping.

### Styles

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

### Notes

- `react` and `react-dom` remain peers.
- Inkio owns the Tiptap runtime packages it uses.
- `justify` alignment is unsupported.
- first-party math support was removed. Use [Tiptap Mathematics](https://tiptap.dev/docs/editor/extensions/nodes/mathematics) directly.
