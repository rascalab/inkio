'use client';

import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { resolveExtensionsInput, type ExtensionsInput } from '../utils/extensions-input';
import { getSchemaExtensions } from '../extensions/schema-extensions';
import { renderInkioStaticContent } from '../ssr/render-static-content';

const defaultViewerExtensions = getSchemaExtensions();

export type ViewerProps = {
  content: string | JSONContent;
  extensions?: ExtensionsInput;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
  bordered?: boolean;
};

/**
 * Lightweight read-only viewer. Renders sanitized static HTML without
 * mounting a Tiptap editor instance, so it is SSR-safe and cheap for
 * lists/previews. For interactive read-only (comments, ToC bridges),
 * use `<Editor editable={false}>` instead.
 */
export function Viewer({
  content,
  extensions,
  theme,
  className = '',
  style,
  bordered = true,
}: ViewerProps) {
  const schema = useMemo(() => resolveExtensionsInput(extensions, defaultViewerExtensions), [extensions]);
  const html = useMemo(() => {
    try {
      return renderInkioStaticContent(content, schema).html || '<p></p>';
    } catch (error) {
      // Schema/content mismatches (e.g. foreign JSON pasted as content)
      // otherwise render as an undebuggable empty paragraph.
      console.error('[inkio] Viewer failed to render content:', error);
      return '<p></p>';
    }
  }, [content, schema]);

  return (
    <div
      style={style}
      className={`inkio inkio-viewer${theme ? ` ${theme}` : ''}${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="tiptap ProseMirror inkio-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
