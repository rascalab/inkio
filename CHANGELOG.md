# Changelog

All notable changes to this project will be documented in this file.

Versioning is unified across the publishable Inkio packages.

## [Unreleased]

### Added

- `TocBlock`: an inline table-of-contents block
- ToC minimap, a `theme` prop on the editor, and syntax highlighting for code blocks

### Changed

- upgraded all dependencies to their latest releases, including a TypeScript 6 migration
- the editor theme is now applied via a `dark` CSS class instead of a `data-theme` attribute

### Fixed

- hashtag and mention suggestions no longer crash when the trigger character is typed
- image editor: wheel zoom now works inside the dialog portal, alongside rotation, crop-bounds, and dock layout fixes
- package builds now emit complete TypeScript declaration files for every entry point

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
