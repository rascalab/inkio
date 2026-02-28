# Changelog

All notable changes to this project will be documented in this file.

Versioning is unified across `@inkio/editor`, `@inkio/extension`, and `@inkio/server`.

## [0.0.3] - 2026-03-12

### Initial Release

- `@inkio/editor`: Core editor and viewer components — paragraphs, headings, lists, task lists, images, blockquotes, code blocks, marks (bold, italic, underline, strike, highlight, code, link)
- `@inkio/extension`: Mention, HashTag, SlashCommand, Callout, Equation, ImageEditor, Comment, BlockHandle, ToggleList, WikiLink, Bookmark, Table

### Security

- **Bookmark**: Sanitize `url`, `image`, `favicon` attributes to block `javascript:`, `data:`, `vbscript:` protocols
- **ImageBlock**: Reject dangerous protocols in `src` attribute
- **LinkClickHandler**: Block `javascript:`/`data:`/`vbscript:` protocols on link clicks
- **Callout**: CSS injection prevention via color value validation
- **Equation**: KaTeX sandboxing with `trust: false`, `strict: 'warn'`
