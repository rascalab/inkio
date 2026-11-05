# Changelog

All notable changes to this project will be documented in this file.

Versioning is unified across the publishable Inkio packages.

## [Unreleased]

### Added

- the table context menu offers merge and split when they apply. They existed as commands with no way to reach them; right-clicking a selected cell now keeps the selection, so there is something to merge.
- wiki links: `wikiLinkItems` on the `@inkio/editor` `Editor` (and `items` on the `WikiLink` extension) opens a page suggestion popup after typing `[[`; the chosen item's `id` becomes the link target. Without it, `[[name]]` still converts on the closing `]]`.
- `MarkdownPaste` from the `/markdown` subpaths turns Markdown pasted as plain text into document content. Add it with `extensions`; it is opt-in so the parser stays out of the editor bundle.
- `ui.icons` now reaches every icon the editors draw: new ids `grip`, `insert`, `close`, `copy`, `duplicate`, `delete`, `text`, `tableOfContents`, `image`, `edit` and `spinner`, plus node views and the block menu, which used to draw theirs directly. The toggle arrow, whose button Tiptap owns, follows the `--inkio-toggle-chevron` CSS variable.
- `useReadOnlyContentSync` in `@inkio/core` keeps a read-only editor in step with its `content` prop.

### Changed

- the table context menu holds only what the table offers no other way to do: merge, split, delete row and delete column. The `+` buttons add rows and columns, and the block handle menu deletes the table.
- `Viewer` in `@inkio/editor` and `@inkio/simple` re-renders when `content` changes, like `@inkio/core`'s `Viewer` and `StaticViewer`. In 0.0.7 it kept the first document. `Editor` still treats `content` as the initial document.
- Tab writes instead of leaving the editor: it nests a list item, indents code (2 spaces), moves between table cells and elsewhere types a tab. Shift+Tab undoes it. Escape leaves the editor, so keyboard users are not trapped; `tabBehavior="default"` keeps browser focus navigation.
- the slash menu opens in any paragraph that starts with `/`, including list items, quotes and table cells, and default commands no longer show a description. `messages.core.slashCommand` entries are plain labels. In a list item a block command replaces the item outside the list (callout did nothing, and table, divider, toggle and table of contents landed inside the item beside an empty line), and a command for the list it is already in does nothing. Table and table of contents are not offered inside a table.
- markdown import no longer reads a single tilde as strikethrough, so `3~5일, 7~9일` stays text. This departs from GFM, which allows one or two tildes. `~~gone~~` still strikes; a document that relied on `~gone~` now reads it literally.

### Fixed

- a document holding a comment, hashtag or bookmark no longer opens empty in an editor or `Viewer` that wasn't configured for them. Tiptap replaces a whole document with an empty one when any node or mark is not in the schema, and saving that would lose it. These three are now always in the schema, without their UI, and `bookmark: false` still turns bookmarks off. Anything else unknown drops only itself: marks go, text stays, a node keeps its children or label, and a console warning names it. This covers the initial `content` and `setContent`.
- typing while an image, table of contents or other whole block is selected writes on a line below it, in Korean too. The block was replaced by the first letter. Delete and Backspace still remove it.
- changing `locale` on the `@inkio/editor` and `@inkio/simple` editors changes everything the editor shows, not only its menus: the slash menu, suggestions, block labels and placeholder kept the first language. The editor is rebuilt with the document kept, so undo history and the caret start over.
- a comment thread whose text was deleted says so in `CommentPanel` instead of repeating its first message as the quote (`messages.commentPanel.quoteGone`).
- writing can continue below an image, table of contents, callout, quote, table or code block at the end of a document. A click under an image or table of contents did nothing and under a callout or quote it went inside: a click below such a block, or ArrowDown at its end, now makes a line to write on. The document does not change until then, so opening it or receiving someone else's edit leaves it alone.
- a table of contents added from the slash menu stays when you keep typing. It stayed selected, so the next key replaced it.
- the block menu's turn into works on lists, tasks, quotes and callouts, where most choices did nothing, and a table, image or divider offers only delete and duplicate.
- Backspace at the start of a list item leaves the list, or joins the item above when it has text, as other editors do. It left a second paragraph hidden inside the item above.
- the slash menu finds commands with a space in their name (`/제목 1`, `/코드 블록`, and `/제목1`), and closes once what follows is plainly a sentence.
- a link typed as `example.com` opens that site instead of a path on the current one, and `me@example.com` becomes a `mailto:` link.
- hashtags and mentions whose label already starts with the trigger no longer show it twice (`##inkio`).
- a table with many columns scrolls sideways instead of squeezing every cell to one letter per line (`cellMinWidth` 96px), and column `+` buttons appear only for edges in view.
- the formatting menu stays away while table cells are selected, where it covered the row above. Format several cells' text by selecting it inside a cell.
- text being commented on stays highlighted while the comment is written, when focus has moved to the composer.
- the table of contents' empty message follows `locale` and shows only to whoever is editing.
- the image editor dialog has a localized name for screen readers, which no longer read its crop zoom number aloud.
- `stringifyMarkdown` throws a `RangeError` for a malformed table whose rows differ so much that padding them would add over a million cells, instead of growing the output without limit. Tables made in an editor are rectangular and never reach this. A document whose aligned tables would come to over 5 million characters, such as one long cell over many rows, is written with unaligned tables.
- an image added from the slash menu, or pasted into an empty paragraph, replaces that paragraph and moves the caret below it. An empty line stayed above the image with the caret in it, so writing went above the image, and a menu covered the image's top.
- the image editor opens in the `locale` of its editor (`ImageEditorComponentProps` gains `locale`), and the Korean close confirmation no longer has an English button.
- closing the image editor without an edit no longer asks to discard, on the button or with Escape. Opening on the resize tool counted its starting crop as a change.
- a table column `+` lands at its boundary when a merged cell shortens the first row.
- markdown export keeps merged tables aligned. A merged cell shifted every value after it into the wrong column; empty cells now hold the columns, and a comment before the table restores the merges on import.
- the image resize handle sits on the image's corner instead of the caption line, and text in selected table cells no longer shows a second highlight.
- `useReadOnlyContentSync` no longer logs a React `flushSync` error when the document has an image or code block.
- the slash menu and the `@`, `#`, `[[` popups follow `locale` and `messages`: their header, empty state and list name, and the default slash commands, which are found by those words (`/표`). They stayed English before, and `/표` found nothing. The slash menu no longer has a "Commands" header.
- `transformSlashCommands` receives the whole default list as documented. It got the list already filtered by the query against the English labels, so a renamed item could not match.
- the words node views show (code block, image block, callout toolbar), the default placeholder and the menus' accessible names follow `locale` and `messages`.
- a task checkbox lines up with its text, table headers with their column, and paragraphs no longer rely on the page's CSS reset to drop the browser's top margin. In a page without one every list item, quote and table cell sat 16px low.
- the formatting and floating menus and the table controls land where they belong on a scrolled page when an ancestor has a transform or filter, which made them drift off screen.
- a toggle just inserted is open, so Enter in its summary goes inside. Toggles read from a document keep their state; ones from markdown stay closed.
- `@` opens no empty popup when the app supplies no mention source.
- `MarkdownPaste` treats a line of `---` as Markdown.
- the code block background is distinct from the page in dark mode, and the floating menu wraps instead of overflowing a narrow screen.
- icons: everything draws from `@inkio/core/icons`. The table plus and the text color clear were hand-drawn, the toggle arrow a CSS triangle, and the block menu and floating menu showed different icons for callout. Default slash commands now carry the same icons as those menus. Menu icons are all 16px at stroke 1.8.
- the block menu opens with focus on the menu instead of its first item, delete, so Enter right after opening no longer removes the block. Arrow keys enter the list. Popups and menus are opaque, so text behind them no longer shows through.
- a block dragged by its handle onto a list lands between the items and splits the list, instead of being merged into an item.
- suggestion popups (`@`, `#`, `/`, `[[`) no longer flash "No results found" on every keystroke. Tiptap 3.31 reports each query with a loading pass before its result and the popup rendered that pass as an empty list; it now keeps the previous list until the result arrives and stays hidden before the first one.
- markdown export: a document containing an image was written without blank lines between blocks, so re-importing it merged the whole document into one paragraph. Images are now exported as their own paragraph.
- markdown export writes wiki links as `[[name]]` instead of `\[\[name]]`, so other markdown tools still read them as links.
- markdown export no longer escapes a lone `~` or an underscore inside a word (`3\~5`, `user\_id`), and no longer puts blank lines between list items.

## [0.0.7] - 2026-10-07

See [MIGRATION.md](./MIGRATION.md#006--007) for upgrade steps.

### Breaking Changes

- `content` is now the initial document only (Tiptap semantics): `initialContent` and the controlled sync mode are removed, so changing `content` after mount no longer updates the editor. Push later changes through the editor instance (`editor.commands.setContent()`). Applies to `Editor` in `@inkio/core`, `@inkio/simple`, `@inkio/editor` and to `useInkioEditor`.
- `parseMarkdown`, `stringifyMarkdown` and `createMarkdownAdapter` are no longer exported from the `@inkio/core`, `@inkio/simple` and `@inkio/editor` package roots; import them from the `/markdown` subpaths. This keeps `unified`/`remark` out of the main editor bundle.
- dark mode is driven by a `dark` class instead of the `data-theme` attribute: use the new `theme="dark"` prop or a `.dark` / `.dark-theme` ancestor. `data-theme="auto"` is no longer recognized.
- `@inkio/core` no longer exports the `TableOfContentsConfig` type; the `ToC` component takes `ToCProps`.
- `@inkio/editor` `Viewer` no longer accepts `comment={false}`; omit `comment` to disable comments.
- type declarations are now complete. 0.0.6 shipped declarations in which many props resolved to `any`, so TypeScript can now report errors in code that compiled before.

### Added

- `@inkio/collab`: new package for Yjs real-time collaboration over Hocuspocus (`useInkioCollaborativeEditor`, `createCollabProvider`, `CollabPresence`, `useCollabPeers`, plus a re-exported `EditorContent` so apps never install `@tiptap/react` themselves), with remote carets, read-only scopes, deterministic seeding and an optional IndexedDB offline cache. A reference server lives in `examples/collab-server`.
- `StaticViewer` and the `@inkio/core/static` subpath: an engine-free static HTML render path for previews and lists. `Viewer` is now also exported from `@inkio/core`.
- `TocBlock`: an inline table-of-contents block (`/toc` slash command), plus a ToC minimap overlay
- `theme` prop (`'light' | 'dark'`) on `Editor` and `Viewer`; `onCreate` on the `@inkio/simple` `Viewer`
- code block syntax highlighting with highlight.js grammars loaded on demand
- table editing redesigned around boundary `+` insert buttons and a right-click context menu
- image editor: filter presets and fine-tuning, redact (pixelate/blur) and sticker tools, plus a redesigned dock and modal layout
- built-in Korean messages: `koCoreMessages`, `koCommentMessages`, `koImageEditorMessages`
- comments: `onReply` / `onResolve` / `onDelete` are optional, so read-only views render no dead buttons; thread data stays fresh without manual notification, and `notifyCommentThreadsChanged` is exported for direct `Comment` extension users
- `onClick` on `Mention` and `HashTag`; `loadingPreviewText` on `Bookmark`
- `getDefaultExtensions` in `@inkio/advanced` accepts every core extension option
- markdown: `[[wiki links]]` round-trip
- `ImageBlockOptions.onUpload` receives an optional upload context as its second argument
- helpers for custom integrations in `@inkio/core`, including `createLatestWinsItems`, `createOverlayHost`, `useDismissableLayer`, `useCoalescedDocUpdate` and `InkioErrorBoundary`

### Changed

- upgraded all dependencies to their latest releases (Tiptap 3.31, React 19.3, Vite 8.3, Vitest 5); type-checking runs on TypeScript 7, with the TypeScript 6 API kept for declaration tooling
- performance: smaller initial editor bundle (lazy grammars, markdown split out), heading, list-merge, comment and block-handle work limited to transactions and ranges that can affect them, image editor drags and freehand strokes batched per animation frame

### Fixed

- hashtag and mention suggestions no longer crash when the trigger character is typed
- `onUpdate` no longer fires on mount or when only `editable` changes; it now reports document changes only
- image editor: wheel zoom inside the dialog portal, rotation distortion, shape offset after rotation, crop bounds, and fine-tune undo steps now coalesce
- image upload placeholder renders as a loading box
- callout icon input takes focus on click and follows the current icon
- package builds now emit complete TypeScript declaration files for every entry point

### Security

- markdown exports are escaped and serialization depth is bounded
- image sources, upload URLs and links reject unsafe protocols (including SVG data URL chains); external links get `rel` protection against tabnabbing
- the image editor rejects malformed colors, and collab peer colors are validated before they reach CSS

## [0.0.6] - 2026-03-20

### Breaking Changes

- removed `@inkio/essential`; its document extensions (callout, details/toggle, table, keyboard shortcuts) are now part of `@inkio/core`

## [0.0.5] - 2026-03-15

### Layered Package Layout

- `@inkio/core`: low-level editor/viewer foundation, toolbar/menu primitives, markdown helpers
- `@inkio/essential`: markdown-friendly document extensions
- `@inkio/advanced`: notion-like and integration-heavy extensions, including comment UI
- `@inkio/simple`: classic WYSIWYG entry point
- `@inkio/editor`: notion-like high-level entry point
- `@inkio/image-editor`: optional image editing UI

### Breaking Changes

- removed `@inkio/extension`
- removed `@inkio/comment`
- markdown helpers moved to `@inkio/core/markdown` and are re-exported from `@inkio/simple/markdown` and `@inkio/editor/markdown`
- markdown import/export now uses `remark/unified` with direct `JSONContent <-> mdast` mapping instead of an HTML bridge
- `justify` alignment is unsupported
- first-party math support was removed; use Tiptap Mathematics directly if needed
- `@inkio/editor` CSS now owns the advanced preset styles it depends on

### Security

- **Bookmark**: Sanitize `url`, `image`, `favicon` attributes to block `javascript:`, `data:`, `vbscript:` protocols
- **ImageBlock**: Reject dangerous protocols in `src` attribute
- **LinkClickHandler**: Block `javascript:`/`data:`/`vbscript:` protocols on link clicks
- **Callout**: CSS injection prevention via color value validation
