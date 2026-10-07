# Changelog

All notable changes to this project will be documented in this file.

Versioning is unified across the publishable Inkio packages.

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
