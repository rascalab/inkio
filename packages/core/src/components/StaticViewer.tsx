'use client';

import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { resolveExtensionsInput, type ExtensionsInput } from '../utils/extensions-input';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import { Viewer as CoreViewer } from './Viewer';

export type StaticViewerProps = {
  content: string | JSONContent;
  theme?: 'light' | 'dark';
  ui?: {
    className?: string;
    style?: React.CSSProperties;
    bordered?: boolean;
  };
  extensions?: ExtensionsInput;
};

/**
 * Zero-engine read-only viewer. Renders sanitized static HTML without
 * mounting a Tiptap instance — a fraction of the `<Viewer>` bundle cost,
 * ideal for lists, previews, and SEO content.
 *
 * Differences from `<Viewer>`: no `locale`/`messages`/`icons` (no
 * interactive UI is rendered) and no `onCreate` (there is no editor
 * instance). Content authored with non-core extensions (e.g. comments,
 * mentions, bookmarks) needs their schema passed via `extensions`,
 * otherwise rendering falls back to an empty shell. For interactive
 * read-only (comments, selection), use `<Viewer>` instead.
 */
export function StaticViewer({ content, theme, ui, extensions }: StaticViewerProps) {
  const resolved = useMemo(
    () => resolveExtensionsInput(extensions, resolveInkioExtensions([], undefined)),
    [extensions],
  );

  return (
    <CoreViewer
      content={content}
      extensions={resolved}
      theme={theme}
      className={ui?.className}
      style={ui?.style}
      bordered={ui?.bordered}
    />
  );
}
