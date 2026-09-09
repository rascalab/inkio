'use client';

import { useMemo } from 'react';
import type { Extensions, JSONContent } from '@tiptap/react';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import { renderInkioStaticContent } from '../ssr/render-static-content';

export type ViewerProps = {
  content: string | JSONContent;
  extensions?: Extensions;
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
  theme = 'light',
  className = '',
  style,
  bordered = true,
}: ViewerProps) {
  const resolved = useMemo(
    () => resolveInkioExtensions(extensions ?? [], undefined),
    [extensions],
  );
  const html = useMemo(() => {
    try {
      return renderInkioStaticContent(content, resolved).html || '<p></p>';
    } catch {
      return '<p></p>';
    }
  }, [content, resolved]);

  return (
    <div
      style={style}
      className={`inkio inkio-viewer${theme === 'dark' ? ' dark' : ''}${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="tiptap ProseMirror inkio-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
