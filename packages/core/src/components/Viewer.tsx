import { type Extensions, type JSONContent } from '@tiptap/core';
import type { HeadingItem, TableOfContentsConfig } from './ToC';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import { renderInkioStaticContent } from '../ssr/render-static-content';
import { ViewerHeadingsBridge } from './ViewerHeadingsBridge';

type ViewerContentMode =
  | {
    content: string | JSONContent;
    initialContent?: never;
  }
  | {
    content?: never;
    initialContent?: string | JSONContent;
  };

export type ViewerProps = ViewerContentMode & {
  extensions?: Extensions;
  placeholder?: string;
  className?: string;
  /** Viewer container style */
  style?: React.CSSProperties;
  /** Show default container border and padding */
  bordered?: boolean;
  /** Built-in table of contents. `true` uses the default top position. */
  tableOfContents?: boolean | TableOfContentsConfig;
  /** Receives extracted headings and a scroll helper for custom TOC UIs. */
  onHeadingsReady?: (headings: HeadingItem[], scrollToIndex: (index: number) => void) => void;
};

export function Viewer({
  content,
  initialContent,
  extensions = [],
  placeholder,
  className = '',
  style,
  bordered = true,
  tableOfContents,
  onHeadingsReady,
}: ViewerProps) {
  if (content !== undefined && initialContent !== undefined) {
    throw new Error('Inkio Viewer: `content` and `initialContent` cannot be used together.');
  }

  const viewerContent = content ?? initialContent ?? '';
  const tocConfig = tableOfContents === true
    ? { position: 'top' as const, maxLevel: 4 }
    : (tableOfContents && typeof tableOfContents === 'object' ? tableOfContents : null);

  const finalExtensions = resolveInkioExtensions(extensions, placeholder);
  const rendered = renderInkioStaticContent(viewerContent, finalExtensions);
  const headings = rendered.headings;

  const tocItems = !tocConfig
    ? []
    : headings.filter((heading) => heading.level <= (tocConfig.maxLevel ?? 4));

  const contentArea = (
    <div className="tiptap inkio-viewer-static-root" data-inkio-viewer-static="">
      <div
        className="ProseMirror inkio-viewer-static"
        dangerouslySetInnerHTML={{ __html: rendered.html || '<p></p>' }}
      />
    </div>
  );

  const tocNavigation = tocItems.length > 0 ? (
    <nav className="inkio-viewer-toc" aria-label="Table of contents">
      <ul className="inkio-viewer-toc-list">
        {tocItems.map((heading) => (
          <li
            key={heading.id}
            className="inkio-viewer-toc-item"
            style={{ ['--inkio-toc-level' as string]: String(heading.level) }}
          >
            <a
              href={`#${heading.id}`}
              className="inkio-viewer-toc-link"
            >
              {heading.text || 'Untitled section'}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  ) : null;

  const position = tocConfig?.position ?? 'top';
  const viewerClasses = [
    'inkio',
    'inkio-viewer',
    bordered ? 'inkio-container-default' : '',
    tocNavigation ? 'inkio-viewer-with-toc' : '',
    tocNavigation ? `inkio-viewer--toc-${position}` : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      style={style}
      className={viewerClasses}
    >
      {onHeadingsReady ? (
        <ViewerHeadingsBridge headings={headings} onHeadingsReady={onHeadingsReady} />
      ) : null}
      {tocNavigation && position === 'top' ? tocNavigation : null}
      {tocNavigation && position !== 'top' ? (
        <>
          {position === 'left' ? tocNavigation : null}
          <div className="inkio-viewer-body">{contentArea}</div>
          {position === 'right' ? tocNavigation : null}
        </>
      ) : (
        contentArea
      )}
    </div>
  );
}
