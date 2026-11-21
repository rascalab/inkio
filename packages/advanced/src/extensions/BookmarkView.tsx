import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { memo, useEffect, useRef, useState } from 'react';
import { sanitizeUrlOrEmpty } from '@inkio/core';
import type { BookmarkOptions } from './bookmark-types';

function isResolvableWebUrl(url: string): boolean {
  if (url.length > 4096 || !/^https?:\/\/[^/\\\s]/i.test(url) || /[\\\s\u0000-\u001f\u007f]/.test(url)) {
    return false;
  }
  try {
    const { hostname, username, password } = new URL(url);
    const host = hostname.toLowerCase().replace(/\.$/, '');
    // DNS names only; never pass literal IPs or ordinary local hostnames to the resolver.
    return !username && !password && !url.slice(url.indexOf('//') + 2).split(/[/?#]/, 1)[0].includes('@') &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z][a-z0-9-]*$/.test(host) &&
      !/(?:^|\.)(?:local|localhost|internal|home\.arpa)$/.test(host);
  } catch {
    return false;
  }
}

function previewUpdate(preview: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!preview || typeof preview !== 'object') return next;
  for (const key of ['title', 'description', 'image', 'favicon'] as const) {
    const value = (preview as Record<string, unknown>)[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (key === 'image' || key === 'favicon') {
      const safeUrl = sanitizeUrlOrEmpty(value);
      if (isResolvableWebUrl(safeUrl)) next[key] = safeUrl;
    } else {
      next[key] = value;
    }
  }
  return next;
}

const BookmarkViewInner = ({ node, updateAttributes, extension, editor, getPos }: NodeViewProps) => {
  const [resolvingNode, setResolvingNode] = useState<typeof node | null>(null);
  const options = extension.options as BookmarkOptions;
  const resolver = options.onResolveBookmark;

  const url = sanitizeUrlOrEmpty(node.attrs.url);
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : '';
  const description = typeof node.attrs.description === 'string' ? node.attrs.description : '';
  const image = sanitizeUrlOrEmpty(node.attrs.image);
  const favicon = sanitizeUrlOrEmpty(node.attrs.favicon);

  const hasPreviewData = Boolean(title || description || image || favicon);
  const { previewRequests } = editor.storage.bookmark;
  const canResolve = Boolean(resolver) && editor.isEditable && isResolvableWebUrl(url);
  // Node view callbacks can be rebound without changing the URL. Keep the
  // latest target without restarting a pending request for the same bookmark.
  const latest = useRef({ node, resolver, updateAttributes, getPos });
  latest.current = { node, resolver, updateAttributes, getPos };

  useEffect(() => {
    const currentResolver = latest.current.resolver;
    if (!canResolve || !currentResolver || hasPreviewData || !previewRequests.has(node)) return;

    let cancelled = false;

    void (async () => {
      // Defer consuming the one-shot grant until React's effect setup survives cleanup.
      const isCurrent = () => {
        if (cancelled || latest.current.node !== node || !editor.isEditable) return false;
        const pos = latest.current.getPos();
        return typeof pos === 'number' && editor.state.doc.nodeAt(pos) === node;
      };
      await Promise.resolve();
      if (!isCurrent() || !previewRequests.delete(node)) return;
      setResolvingNode(node);
      try {
        const preview = await currentResolver(url);
        if (!isCurrent()) return;
        const next = previewUpdate(preview);
        if (Object.keys(next).length) latest.current.updateAttributes(next);
      } catch {
        // A rejected preview leaves a plain, navigable bookmark.
      } finally {
        if (!cancelled) {
          setResolvingNode(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [canResolve, editor, url, hasPreviewData, node, previewRequests]);

  const resolving = resolvingNode === node && canResolve;
  if (!resolving && !hasPreviewData) {
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
        {resolving ? (
          <p className="inkio-bookmark-description">
            {extension.options.loadingPreviewText ?? 'Loading preview...'}
          </p>
        ) : null}
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
