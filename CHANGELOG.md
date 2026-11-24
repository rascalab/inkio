# Changelog

All notable changes to this project will be documented in this file.

Versioning is unified across the publishable Inkio packages.

## [Unreleased]

## [0.2.0] - 2026-11-25

- **Breaking:** With `Markdown` registered, replace `editor.setMarkdown(source)` with `editor.markdown = source`. Rejected assignments throw without clearing the document.
- Fix mounting the full editor preset from CommonJS. The tarball smoke now mounts the packed editor and checks its document projections and Markdown writes.
- Count nested blocks, including images, bookmarks and the table of contents. Text previews preserve bookmark labels, image captions or alt text, toggle boundaries and code whitespace. Saved custom documents can use their original schema via `read(json, { schema })`.
- Markdown round trips no longer insert formatting characters into adjacent marked text or turn escaped wiki brackets into nodes. Preserve end-of-paragraph breaks, captions, inline image content and visible cell text.
- Resolve empty reference labels consistently in live documents, saved JSON and heading links. The table of contents updates when a reference label inside a heading changes.
- Changing React extension registrations replaces the editor without exposing stale extension methods. Equivalent registrations keep the instance; real schema transitions retain compatible document content and selection.

## [0.1.1] - 2026-11-25

- Docs: browse release-tagged documentation with version-scoped navigation and search, and follow a Yjs recipe to run and verify a local collaboration session.
- Collab: opt-in `@inkio/collab/vite` builds an offline app shell for allowlisted SPA routes without caching API responses or changing document access rules.
- Examples: the React Router collaboration demo includes a local account login with server-enforced editor/viewer access and session revocation.
- Fix CommonJS editor imports and exercise the packed `require()` entry points in the release smoke.
- Publish extension styles as `@inkio/advanced/style.css`. The editor preset stylesheet still includes the full styles.
- Fix missing TypeScript declarations for mention and hashtag suggestions in the published `@inkio/advanced` package.
- Keep the standalone static viewer free of editor node views and lazy highlighting grammars; preserve inline table-of-contents blocks through Markdown.
- Use the same drop position for mouse and touch block dragging, and commit image crop gestures without a second synchronization render.
- Preserve reference links, images, unknown directive text and mixed-list numbering when importing Markdown. Export unusable image sources as alt text.
- Keep safe formatting, task checkbox layout, open disclosures and unique generated heading anchors in static previews. Reopening a callout's HTML preserves its type and custom color.
- Isolate image edits, undo history and save completion when the source changes. Preserve small crop selections and their pending output dimensions.
- Image save callbacks and preset image uploads receive an `AbortSignal` so hosts can cancel pending requests when their editing target disappears.
- Remove six unused image editor message keys. The [migration guide](./MIGRATION.md#009--011) lists the overrides to drop; no visible controls were removed.
- Rotating or flipping reuses the photo raster, even with editable annotations. Full-resolution export still uses the original image. The Next.js demo no longer rerenders the editor to report debug state.
- Image editor: clicking the blank canvas after text entry restores keyboard focus. Drawing a shape uses the release position even when the browser skips the last pointer move.
- Standalone image editors no longer load the Tiptap document runtime. The canvas and export worker now import only the Konva shapes and filters they use.
- Text-only named imports from the editor presets no longer bundle the editor. Interactive viewers keep their node views and comment threads without loading editing menus; code highlighting loads its engine and grammars when a code block first needs them.
- Editor instances expose `text`, `stats`, `summary(maxLength)`, `mentions`, `hashTags`, `headings` and `commentIds`. Live and saved text include inline reference labels and share one summary length limit. Register `Markdown` to use `editor.markdown` and `editor.setMarkdown(source)`.
- **Breaking:** `read(json)` from `@inkio/core`, `@inkio/simple` or `@inkio/editor` replaces the standalone saved-JSON getters. Its read-only `InkioDocument` exposes the same document members as the live editor. See the [old-to-new mapping](./MIGRATION.md#reading-saved-json-without-an-editor).
- Extension arrays add to defaults across presets and core. A preset menu options object enables that menu; `onChange` delivers the editor without requiring a JSON snapshot. Comment panels inherit the editor's registered actions. See the [migration guide](./MIGRATION.md#009--011) for affected options.
- Bind the authenticated collaboration example to the verified login on reconnect and logout. Reconcile offline updates after authentication without reopening destroyed transports.
- Keep menu shortcuts with the focused toolbar, dismiss suggestions on focus exit and ignore obsolete suggestion results. A slash image picker no longer replaces content edited while the chooser was open.
- Floating toolbar buttons accept keyboard focus as soon as the menu opens. Submitting a comment or selecting its quote no longer schedules a focus change that can interrupt typing a reply.
- Saving a link and immediately reopening it with the keyboard keeps focus in the URL field. Dismissing the link popover by clicking elsewhere leaves focus on the clicked control.
- Load collaboration-only editor code with the React Router collaboration routes instead of the initial document.

## [0.0.9] - 2026-11-22

See [MIGRATION.md](./MIGRATION.md#008--009) for runtime, image storage, and collaboration changes.

### Added

- editors provide a localized accessible label for the editable body; set `ariaLabel` to distinguish multiple editors.
- the image workbench uses compact tool controls, on-canvas text editing and live dimension changes.
- both editor presets can place the built-in toolbar above or below the document and configure the alignment, direction, and collision behavior of contextual menus.
- the React Router example shows edit/read routes for multiple documents with in-memory drafts and a bottom toolbar.
- image editor tools can mix custom controls and built-ins, use the same edit history and export commands, and move the tool rail independently on desktop and mobile.

### Changed

- the SDK requires Node.js 22.12 or newer. `@inkio/image-editor` requires React and React DOM 19.3 or newer within React 19; the base editors still support React 18.
- image `cleanup` defaults to `manual`. Even with explicit `immediate` cleanup, removing a document reference never deletes a file. `onDelete` only handles a newly uploaded file that could not enter the document.
- bookmark previews resolve for explicit new bookmark insertions, not for imported or collaborative document content.
- live and static rendering bound expanded table dimensions before building the table. Markdown import also rejects documents outside its parser work budget.
- the landing, guides, and playground share one layout, search, theme switch, and LINE Seed Sans KR typography. The landing explains the two editor presets and loads the live demo only on request; the playground serializes only when its preview is visible and editing stops.
- image export encodes asynchronously and bounds source, preview, and output rasters. The image workbench supports keyboard canvas editing and uses one scrollable tool row on phones.
- the image workbench puts the scale ruler below the photo, uses a fill-only tool selection, and dims actual overflowing image pixels rather than duplicating the photo as a background.
- the image preview uses the same transparency checkerboard in both themes. Crop drag settles at the edge without committing overscroll; large image exports use a lazy worker when supported.
- the document and image editors share fill-only control states. Document text has higher contrast, and the classic toolbar stays on one scrollable row without taking space away from the document.
- desktop and touch block drags show a preview card with padding outside the original block width, preserving line breaks, and mark the insertion point.
- touch block drags auto-scroll at the upper and lower edges of the editor or page, with the insertion marker following the new drop position.
- block menus move a block up or down one sibling without dragging, including within lists. On touch devices, menu rows have 44px targets and the menu scrolls on short screens.
- collaborative offline data is scoped by account and deployment. The reference server requires document-scoped access rules, binds privately by default, and validates and flushes snapshots.

### Fixed

- edited images use the configured image upload callback instead of persisting a data URL directly. The original image stays in the document until upload succeeds; upload limits, URL resolution and error callbacks also apply to edited files.
- image editing waits for asynchronous saves before closing. Failed saves keep the edits for retry, unchanged images skip the upload, and edited files have distinct names instead of all using `edited-image.png`.
- image uploads keep transient placeholders out of saved content and undo history. Inserting from the slash menu leaves the caret ready for typing below the image.
- unsupported Markdown images without alt text no longer blank the document. Details transforms ignore fenced code, and exported wiki labels are escaped.
- the table menu does not remeasure an idle table continuously. Syntax highlighting updates changed blocks without retokenizing the entire document.
- runtime dependency upgrades remove the audited advisories; CI checks the lockfile, real collaboration modes, and consumer installs on supported Node and React versions.
- CommonJS React overlay loading emits a literal lazy dependency request, avoiding a Next.js Webpack warning without changing the ESM build.
- document formatting buttons can be activated from the keyboard, and toolbar popovers inherit the palette of the editor that opened them.
- saving large inline photos uses asynchronous bitmap decoding even when the export worker is unavailable, and separates canvas rendering from the encoder's buffer snapshot.
- image upload can take the encoded Blob directly, avoiding conversion to and from a large data URL. Existing data URL callbacks still work.
- image load errors omit source URLs so credentials in signed URLs are not recorded by the editor logger.
- touch block drags hide the source handle while scrolling, and tapping the handle opens its menu without selecting the item underneath the finger.
- workerless large-image export applies color filters in bounded bands, leaving room for input and painting without lowering output resolution.
- document and image popovers reuse the shared palette, tightly spaced mobile panels stay inside the viewport, and code highlighting follows each editor's theme instead of a page-global stylesheet.
- custom React slots preserve component identity, and block transformations refuse stale targets.
- a repeated up/down menu action keeps targeting the just-moved block instead of switching to its neighbor.
- opening a block menu with Shift+F10 or the context-menu key keeps the source block highlighted until the next key or editor click.

## [0.0.8] - 2026-11-06

See [MIGRATION.md](./MIGRATION.md#007--008) for behavior changes to check.

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
- changing `locale` on an editor changes everything it shows, not only its menus: the slash menu, suggestions, block labels and placeholder kept the first language. `messages`, `icons` and `InkioProvider` changes reach them too. The document, caret and undo history stay. With `useInkioEditor`, call the new `setEditorUi(editor, { locale })`.
- `CommentPanel` lists only threads whose text is in the document. Deleting the text removes the thread from the panel, and undo brings it back. `onDelete` is not called, so the thread stays in your store: clear it on save with the new `getCommentIds(doc)`. Before, it stayed in the panel with its first message repeated as the quote.
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
