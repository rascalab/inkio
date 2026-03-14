import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, Extensions, JSONContent } from '@tiptap/react';
import type { InkioAdapter } from '../adapter';
import type { DefaultExtensionsFactory } from '../context/InkioProvider';
import { useInkioContext } from '../context/InkioProvider';
import { getExtensions } from '../extensions/defaults';
import type { InkioExtensionRegistry } from '../extensions/registry';
import type { HeadingItem, TableOfContentsConfig } from './ToC';
import { getHeadingsFromContent } from './ToC';

const EMPTY_DOC: JSONContent = { type: 'doc', content: [] };
const HEADING_SELECTOR = '.ProseMirror :is(h1, h2, h3, h4, h5, h6)';

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
  extensionRegistry?: InkioExtensionRegistry;
  adapter?: InkioAdapter;
  /** Factory that returns the full extension set when adapter is provided. */
  getDefaultExtensions?: DefaultExtensionsFactory;
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
  extensionRegistry,
  adapter,
  getDefaultExtensions,
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

  const ctx = useInkioContext();
  const resolvedAdapter = adapter ?? ctx.adapter;
  const resolvedFactory = getDefaultExtensions ?? ctx.getDefaultExtensions;

  const viewerContent = content ?? initialContent ?? '';
  const tocConfig = tableOfContents === true
    ? { position: 'top' as const, maxLevel: 4 }
    : (tableOfContents && typeof tableOfContents === 'object' ? tableOfContents : null);

  const finalExtensions = useMemo(() => {
    // Consumer-provided extensions take priority
    if (extensions.length > 0) {
      return extensions;
    }

    // When adapter + getDefaultExtensions factory: use full extension set
    if (resolvedAdapter && resolvedFactory) {
      return resolvedFactory(resolvedAdapter);
    }

    // Fallback: core extensions + optional registry
    return [
      ...getExtensions({ placeholder }),
      ...(extensionRegistry?.getExtensions() ?? []),
    ] as Extensions;
  }, [extensions, resolvedAdapter, resolvedFactory, extensionRegistry, placeholder]);

  const isMountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedContent, setRenderedContent] = useState<JSONContent>(() => (
    typeof viewerContent === 'string' ? EMPTY_DOC : (viewerContent || EMPTY_DOC)
  ));
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: finalExtensions,
    content: viewerContent,
    editable: false,
    editorProps: {
      attributes: {
        class: className,
      },
    },
  });

  const lastExternalContentRef = useRef(content ?? initialContent);
  const syncRenderedContent = useCallback(() => {
    if (editor && !editor.isDestroyed) {
      setRenderedContent(editor.getJSON());
    }
  }, [editor]);

  const headings = useMemo(
    () => getHeadingsFromContent(renderedContent),
    [renderedContent],
  );

  const tocItems = useMemo(() => {
    if (!tocConfig) {
      return [];
    }

    const maxLevel = tocConfig.maxLevel ?? 4;
    return headings.filter((heading) => heading.level <= maxLevel);
  }, [headings, tocConfig]);

  const scrollToIndex = useCallback((index: number) => {
    const nodes = containerRef.current?.querySelectorAll<HTMLElement>(HEADING_SELECTOR);
    const target = nodes?.[index];

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== undefined) {
      const isSame = content === lastExternalContentRef.current
        || (typeof content !== 'string'
          && JSON.stringify(content) === JSON.stringify(lastExternalContentRef.current));

      if (!isSame) {
        lastExternalContentRef.current = content;
        queueMicrotask(() => {
          if (isMountedRef.current && !editor.isDestroyed) {
            editor.commands.setContent(content);
            syncRenderedContent();
          }
        });
      }
    }
  }, [editor, content, syncRenderedContent]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    queueMicrotask(() => {
      if (isMountedRef.current && !editor.isDestroyed) {
        syncRenderedContent();
      }
    });
  }, [editor, viewerContent, finalExtensions, syncRenderedContent]);

  useEffect(() => {
    if (!onHeadingsReady) {
      return;
    }

    onHeadingsReady(headings, scrollToIndex);
  }, [headings, onHeadingsReady, scrollToIndex]);

  useEffect(() => {
    if (!containerRef.current || headings.length === 0) {
      return;
    }

    const container = containerRef.current;
    const raf = requestAnimationFrame(() => {
      const nodes = container.querySelectorAll<HTMLElement>(HEADING_SELECTOR);

      nodes.forEach((node, index) => {
        const heading = headings[index];
        if (!heading) {
          return;
        }

        node.id = heading.id;
        node.dataset.inkioHeadingIndex = String(heading.index);
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      const nodes = container.querySelectorAll<HTMLElement>(HEADING_SELECTOR);
      nodes.forEach((node) => {
        node.removeAttribute('id');
        node.removeAttribute('data-inkio-heading-index');
      });
    };
  }, [headings]);

  const contentArea = <EditorContent editor={editor} />;

  const tocNavigation = tocItems.length > 0 ? (
    <nav className="inkio-viewer-toc" aria-label="Table of contents">
      <ul className="inkio-viewer-toc-list">
        {tocItems.map((heading) => (
          <li
            key={heading.id}
            className="inkio-viewer-toc-item"
            style={{ ['--inkio-toc-level' as string]: String(heading.level) }}
          >
            <button
              type="button"
              className="inkio-viewer-toc-link"
              onClick={() => scrollToIndex(heading.index)}
            >
              {heading.text || 'Untitled section'}
            </button>
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
      ref={containerRef}
      style={style}
      className={viewerClasses}
    >
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
