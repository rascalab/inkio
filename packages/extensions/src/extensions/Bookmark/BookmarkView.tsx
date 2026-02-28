import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type { BookmarkOptions, BookmarkPreview } from './Bookmark';

const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript):/i;
const sanitizeUrl = (url: string) => (BLOCKED_PROTOCOLS.test(url.trim()) ? '' : url);

const resolvePreviewUpdate = (preview: BookmarkPreview): Record<string, string | null> => {
  const nextAttributes: Record<string, string | null> = {};

  if (preview.title !== undefined) {
    nextAttributes.title = preview.title ?? null;
  }

  if (preview.description !== undefined) {
    nextAttributes.description = preview.description ?? null;
  }

  if (preview.image !== undefined) {
    nextAttributes.image = preview.image ?? null;
  }

  if (preview.favicon !== undefined) {
    nextAttributes.favicon = preview.favicon ?? null;
  }

  return nextAttributes;
};

export const BookmarkView = ({ node, updateAttributes, extension }: NodeViewProps) => {
  const [resolving, setResolving] = useState(false);
  const options = extension.options as BookmarkOptions;
  const resolver = options.onResolveBookmark;

  const url = sanitizeUrl(String(node.attrs.url || ''));
  const title = node.attrs.title ? String(node.attrs.title) : '';
  const description = node.attrs.description ? String(node.attrs.description) : '';
  const image = node.attrs.image ? sanitizeUrl(String(node.attrs.image)) : '';
  const favicon = node.attrs.favicon ? sanitizeUrl(String(node.attrs.favicon)) : '';

  const hasPreviewData = Boolean(title || description || image || favicon);

  useEffect(() => {
    if (!resolver || !url || hasPreviewData) {
      return;
    }

    let cancelled = false;
    setResolving(true);

    resolver(url)
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
  }, [resolver, url, hasPreviewData, updateAttributes]);

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
