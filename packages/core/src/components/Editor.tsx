'use client';

import { EditorContent, type Extensions, type JSONContent, type Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInkioEditor } from '../hooks/use-inkio-editor';
import { BubbleMenu } from './BubbleMenu';
import type { BubbleMenuProps } from './BubbleMenu';
import { FloatingMenu } from './FloatingMenu';
import type { FloatingMenuProps } from './FloatingMenu';
import { TableMenu } from './TableMenu';
import type { TableMenuProps } from './TableMenu';
import { Toolbar } from './Toolbar';
import type { ToolbarProps } from './Toolbar';
import type { InkioCoreMessageOverrides, InkioLocaleInput, InkioMessageOverrides } from '../i18n/messages';
import type { InkioIconRegistry } from '../icons/registry';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import {
  createEditorPlaceholderHtml,
  renderInkioStaticContent,
} from '../ssr/render-static-content';

type EditorContentMode =
  | {
    content: string | JSONContent;
    initialContent?: never;
  }
  | {
    content?: never;
    initialContent?: string | JSONContent;
  };

export type EditorProps = EditorContentMode & {
  extensions?: Extensions;
  placeholder?: string;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
  className?: string;
  /** Color theme */
  theme?: 'light' | 'dark';
  /** 에디터 컨테이너 스타일 */
  style?: React.CSSProperties;
  /** Fill the parent container height instead of sizing to content. */
  fill?: boolean;
  /** Automatically grow editor height to fit content. Mutually exclusive with `fill`. */
  autoresize?: boolean;
  /** Show default container border and padding */
  bordered?: boolean;
  /** Whether to show the bubble menu */
  showBubbleMenu?: boolean;
  /** Whether to show the floating menu */
  showFloatingMenu?: boolean;
  /** Whether to show the persistent top toolbar */
  showToolbar?: boolean;
  /** Whether to show the table action menu when the selection is inside a table. */
  showTableMenu?: boolean;
  /** Toolbar configuration when `showToolbar` is enabled. */
  toolbar?: Omit<ToolbarProps, 'editor'>;
  /** Bubble menu configuration when `showBubbleMenu` is enabled. */
  bubbleMenu?: Omit<BubbleMenuProps, 'editor'>;
  /** Floating menu configuration when `showFloatingMenu` is enabled. */
  floatingMenu?: Omit<FloatingMenuProps, 'editor'>;
  /** Table menu configuration when `showTableMenu` is enabled. */
  tableMenu?: Omit<TableMenuProps, 'editor'>;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
  locale?: InkioLocaleInput;
  /** Message overrides for core menu labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides by action id */
  icons?: Partial<InkioIconRegistry>;
};

/**
 * Cheap equality for static SSR content. String content compares by value
 * (React useMemo already does this, but JSON objects compare by identity —
 * an inline object literal would otherwise re-run generateHTML + sanitize
 * on every parent re-render). Identity wins first (O(1)); JSON.stringify
 * is still far cheaper than generateHTML + sanitize-html.
 */
export function isEqualStaticContent(a: string | JSONContent | undefined, b: string | JSONContent | undefined): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'string') return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

const EMPTY_EDITOR_EXTENSIONS: Extensions = [];

export const Editor = ({
  content,
  initialContent,
  extensions = EMPTY_EDITOR_EXTENSIONS,
  placeholder,
  editable = true,
  onUpdate,
  onCreate,
  className = '',
  theme = 'light',
  style,
  fill = false,
  autoresize = false,
  bordered = true,
  showToolbar = false,
  showBubbleMenu = false,
  showFloatingMenu = false,
  showTableMenu = true,
  toolbar,
  bubbleMenu,
  floatingMenu,
  tableMenu,
  locale,
  messages,
  icons,
}: EditorProps) => {
  if (content !== undefined && initialContent !== undefined) {
    throw new Error('Inkio Editor: `content` and `initialContent` cannot be used together.');
  }

  const resolvedExtensions = useMemo(
    () => resolveInkioExtensions(extensions, placeholder),
    [extensions, placeholder],
  );

  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (fill && autoresize) {
    console.warn('Inkio Editor: `fill` and `autoresize` are mutually exclusive. `fill` takes precedence.');
  }

  const editor = useInkioEditor({
    ...(content !== undefined ? { content } : { initialContent }),
    // Reuse the already-resolved extensions so static SSR HTML and the live
    // editor share a single schema instance.
    extensions: resolvedExtensions,
    placeholder,
    editable,
    onUpdate,
    onCreate: (instance) => {
      setEditorInstance(instance);
      onCreate?.(instance);
    },
  });
  const initialContentValue = content ?? initialContent;
  // Static SSR shell: never recompute generateHTML + sanitize when content is
  // unchanged. useMemo alone keys on object identity, so an inline JSON
  // literal from a re-rendering parent would redo the expensive render every
  // time — the ref cache below skips it on identity OR deep equality.
  const staticCacheRef = useRef<{
    content: string | JSONContent | undefined;
    extensions: Extensions;
    result: ReturnType<typeof renderInkioStaticContent>;
  } | null>(null);
  const cached = staticCacheRef.current;
  let staticRender: ReturnType<typeof renderInkioStaticContent>;
  if (
    cached
    && cached.extensions === resolvedExtensions
    && isEqualStaticContent(cached.content, initialContentValue)
  ) {
    staticRender = cached.result;
  } else {
    staticRender = renderInkioStaticContent(initialContentValue, resolvedExtensions);
    staticCacheRef.current = {
      content: initialContentValue,
      extensions: resolvedExtensions,
      result: staticRender,
    };
  }
  const staticHtml = staticRender.html || (editable ? createEditorPlaceholderHtml(placeholder) : '<p></p>');
  const showInteractiveRuntime = isHydrated && !!editor;

  return (
    <div
      style={style}
      className={`inkio inkio-editor${theme === 'dark' ? ' dark' : ''}${fill ? ' inkio-editor--fill' : ''}${!fill && autoresize ? ' inkio-editor--autoresize' : ''}${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
      suppressHydrationWarning
    >
      {showToolbar && (
        showInteractiveRuntime ? (
          <Toolbar
            editor={editorInstance}
            className={toolbar?.className}
            locale={toolbar?.locale ?? locale}
            messages={toolbar?.messages ?? messages}
            icons={toolbar?.icons ?? icons}
            items={toolbar?.items}
          >
            {toolbar?.children}
          </Toolbar>
        ) : (
          <div
            className={`inkio-toolbar inkio-toolbar--ssr-placeholder${toolbar?.className ? ` ${toolbar.className}` : ''}`}
            role="presentation"
            aria-hidden="true"
          >
            <div className="inkio-toolbar-group">
              <span className="inkio-toolbar-skeleton-btn" />
              <span className="inkio-toolbar-skeleton-btn" />
              <span className="inkio-toolbar-skeleton-btn" />
            </div>
            <div className="inkio-toolbar-divider" />
            <div className="inkio-toolbar-group">
              <span className="inkio-toolbar-skeleton-btn inkio-toolbar-skeleton-btn--wide" />
            </div>
          </div>
        )
      )}

      {showInteractiveRuntime && showBubbleMenu && (
        <BubbleMenu
          editor={editorInstance}
          className={bubbleMenu?.className}
          locale={bubbleMenu?.locale ?? locale}
          messages={bubbleMenu?.messages ?? messages}
          icons={bubbleMenu?.icons ?? icons}
          items={bubbleMenu?.items}
        >
          {bubbleMenu?.children}
        </BubbleMenu>
      )}

      {showInteractiveRuntime && showFloatingMenu && (
        <FloatingMenu
          editor={editorInstance}
          className={floatingMenu?.className}
          locale={floatingMenu?.locale ?? locale}
          messages={floatingMenu?.messages ?? messages}
          icons={floatingMenu?.icons ?? icons}
          items={floatingMenu?.items}
        />
      )}

      {showInteractiveRuntime && showTableMenu && (
        <TableMenu
          editor={editorInstance}
          className={tableMenu?.className}
          locale={tableMenu?.locale ?? locale}
          messages={tableMenu?.messages ?? messages}
          icons={tableMenu?.icons ?? icons}
        />
      )}

      {showInteractiveRuntime ? (
        <EditorContent editor={editor} />
      ) : (
        <div
          className="tiptap ProseMirror inkio-content"
          dangerouslySetInnerHTML={{ __html: staticHtml }}
        />
      )}
    </div>
  );
};
