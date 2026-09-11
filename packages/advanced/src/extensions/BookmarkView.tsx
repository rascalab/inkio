import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { memo, useEffect, useRef, useState } from 'react';
import { isSafeUrl } from '@inkio/core';
import type { BookmarkOptions, BookmarkPreview } from './Bookmark';

const sanitizeUrl = (url: string) => (isSafeUrl(url) ? url : '');

const resolvePreviewUpdate = (preview: BookmarkPreview): Record<string, string | null> => {
  const nextAttributes: Record<string, string | null> = {};

  if (preview.title !== undefined) {
    nextAttributes.title = preview.title ?? null;
  }

  if (preview.description !== undefined) {
    nextAttributes.description = preview.description ?? null;
  }

  // Sanitize at write time so unsafe image/favicon URLs never persist in JSON.
  // Render-time sanitizeUrl() remains as a second layer.
  if (preview.image !== undefined) {
    const image = preview.image ? String(preview.image) : '';
    nextAttributes.image = image && isSafeUrl(image) ? image : null;
  }

  if (preview.favicon !== undefined) {
    const favicon = preview.favicon ? String(preview.favicon) : '';
    nextAttributes.favicon = favicon && isSafeUrl(favicon) ? favicon : null;
  }

  return nextAttributes;
};

const BookmarkViewInner = ({ node, updateAttributes, extension }: NodeViewProps) => {
  const [resolving, setResolving] = useState(false);
  const options = extension.options as BookmarkOptions;
  const resolver = options.onResolveBookmark;

  const url = sanitizeUrl(String(node.attrs.url || ''));
  const title = node.attrs.title ? String(node.attrs.title) : '';
  const description = node.attrs.description ? String(node.attrs.description) : '';
  const image = node.attrs.image ? sanitizeUrl(String(node.attrs.image)) : '';
  const favicon = node.attrs.favicon ? sanitizeUrl(String(node.attrs.favicon)) : '';

  const hasPreviewData = Boolean(title || description || image || favicon);
  // Stabilize inline resolvers (recreated per render) so 20 same-URL bookmarks
  // don't refetch in a loop. Identity is tracked via ref; fetch key is `url`.
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;

  useEffect(() => {
    const currentResolver = resolverRef.current;
    if (!currentResolver || !url || hasPreviewData) {
      return;
    }

    let cancelled = false;
    setResolving(true);

    currentResolver(url)
      .then((preview) => {
        if (cancelled || !preview) {
          return;
        }

        const nextAttributes = resolvePreviewUpdate(preview);

        if (Object.keys(nextAttributes).length > 0) {
          updateAttributes(nextAttributes);
        }
      })
      .catch(() => {
        // Fallback rendering is handled below.
      })
      .finally(() => {
        if (!cancelled) {
          setResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, hasPreviewData, updateAttributes]);

  if (!resolver && !hasPreviewData) {
    return (
      <NodeViewWrapper className="inkio-bookmark-wrapper">
        <a href={url} rel="noopener noreferrer nofollow" target="_blank" className="inkio-bookmark-fallback">
          {url}
        </a>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="inkio-bookmark-wrapper">
      <a href={url} rel="noopener noreferrer nofollow" target="_blank" className="inkio-bookmark-card">
        {image ? <img src={image} alt={title || url} className="inkio-bookmark-image" /> : null}

        <div className="inkio-bookmark-title-row">
          {favicon ? <img src={favicon} alt="" width={16} height={16} /> : null}
          <span>{title || url}</span>
        </div>

        {description ? <p className="inkio-bookmark-description">{description}</p> : null}
        {resolving ? <p className="inkio-bookmark-description">Loading preview...</p> : null}
      </a>
    </NodeViewWrapper>
  );
};

// Same per-transaction re-invocation issue as CodeBlockView: tiptap hands a
// fresh decorations array and rebound callbacks on every update, so bail out
// unless our node, selection, or extension config changed. URL/preview
// changes always produce a new node, so the resolve effect still fires.
export const BookmarkView = memo(
  BookmarkViewInner,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.editor === next.editor &&
    prev.extension === next.extension,
);
