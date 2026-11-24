'use client';

import type { JSONContent } from '@tiptap/core';
import type { ExtensionsInput } from '../utils/extensions-input';
import { Viewer } from './Viewer';

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
 * Read-only viewer for lists, previews, and SEO content. Renders sanitized
 * static HTML with the core document schema, without mounting an editor.
 *
 * Content authored with non-core extensions (e.g. comments, mentions,
 * bookmarks) needs their schema passed via `extensions`; otherwise JSON
 * renders an empty shell. For interactive read-only use `<Editor editable={false}>`.
 */
export function StaticViewer({ content, theme, ui, extensions }: StaticViewerProps) {
  return (
    <Viewer
      content={content}
      extensions={extensions}
      theme={theme}
      className={ui?.className}
      style={ui?.style}
      bordered={ui?.bordered}
    />
  );
}
