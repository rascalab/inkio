'use client';

import { EditorContent, type Extensions, type JSONContent, type Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInkioEditor } from '../hooks/use-inkio-editor';
import { setEditorUi, type EditorUi } from '../context/editor-ui';
import { useInkioContext } from '../context/InkioProvider';
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
import { isEqualStaticContent } from '../utils/static-content';
import {
  createEditorPlaceholderHtml,
  renderInkioStaticContent,
} from '../ssr/render-static-content';

export interface EditorProps {
  /** Initial document only (uncontrolled). See `useInkioEditor`. */
  content?: string | JSONContent;
  extensions?: Extensions;
  placeholder?: string;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
  className?: string;
  /** Color theme. Unset follows a `.dark` / `.dark-theme` ancestor; set forces it. */
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

export const Editor = ({
  content,
  extensions,
  placeholder,
  editable = true,
  onUpdate,
  onCreate,
  className = '',
  theme,
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
  // The first placeholder only: later ones reach the live editor below.
  const [firstPlaceholder] = useState(placeholder);
  const resolvedExtensions = useMemo(
    () => resolveInkioExtensions(extensions, firstPlaceholder),
    [extensions, firstPlaceholder],
  );

  // Warn in an effect, not during render: parent re-renders (and
  // StrictMode double-render) would spam the console otherwise.
  useEffect(() => {
    if (fill && autoresize) {
      console.warn('Inkio Editor: `fill` and `autoresize` are mutually exclusive. `fill` takes precedence.');
    }
  }, [fill, autoresize]);

  const editor = useInkioEditor({
    content,
    // Reuse the already-resolved extensions so static SSR HTML and the live
    // editor share a single schema instance.
    extensions: resolvedExtensions,
    placeholder,
    editable,
    onUpdate,
    onCreate,
  });
  // A prop this editor was never given leaves what its extensions were configured with.
  const context = useInkioContext();
  const givenUi = useRef<EditorUi>({});
  const uiLocale = locale ?? context.locale;
  const uiMessages = messages ?? context.messages;
  const uiIcons = icons ?? context.icons;
  useEffect(() => {
    if (!editor) return;
    const current: EditorUi = { locale: uiLocale, messages: uiMessages, icons: uiIcons, placeholder };
    const given = givenUi.current as Record<string, unknown>;
    for (const [key, value] of Object.entries(current)) {
      if (value !== undefined || key in given) given[key] = value;
    }
    setEditorUi(editor, givenUi.current);
  }, [editor, uiLocale, uiMessages, uiIcons, placeholder]);

  // `immediatelyRender: false` keeps `editor` null through SSR and the
  // hydration render (it is created in a mount effect), so a non-null editor
  // already implies the client has hydrated.
  const showInteractiveRuntime = !!editor;
  // Static SSR shell: never recompute generateHTML + sanitize when content is
  // unchanged. useMemo alone keys on object identity, so an inline JSON
  // literal from a re-rendering parent would redo the expensive render every
  // time — the ref cache below skips it on identity OR deep equality. Once
  // the live editor is mounted the shell is not rendered, so skip it
  // entirely (controlled `content` would otherwise pay this per keystroke).
  const staticCacheRef = useRef<{
    content: string | JSONContent | undefined;
    extensions: Extensions;
    result: ReturnType<typeof renderInkioStaticContent>;
  } | null>(null);
  let staticHtml = '';
  if (!showInteractiveRuntime) {
    const cached = staticCacheRef.current;
    let staticRender: ReturnType<typeof renderInkioStaticContent>;
    if (
      cached
      && cached.extensions === resolvedExtensions
      && isEqualStaticContent(cached.content, content)
    ) {
      staticRender = cached.result;
    } else {
      try {
        staticRender = renderInkioStaticContent(content, resolvedExtensions);
      } catch (error) {
        // Out-of-schema content must degrade to the shell, never throw out
        // of render (SSR crash / blank client tree).
        console.warn('[inkio] static render failed, showing shell instead:', error);
        staticRender = {
          json: { type: 'doc', content: [{ type: 'paragraph' }] },
          html: '',
          headings: [],
          shellOnly: true,
        };
      }
      staticCacheRef.current = {
        content,
        extensions: resolvedExtensions,
        result: staticRender,
      };
    }
    staticHtml = staticRender.html || (editable ? createEditorPlaceholderHtml(placeholder) : '<p></p>');
  }

  return (
    <div
      style={style}
      className={`inkio inkio-editor${theme ? ` ${theme}` : ''}${fill ? ' inkio-editor--fill' : ''}${!fill && autoresize ? ' inkio-editor--autoresize' : ''}${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
      suppressHydrationWarning
    >
      {showToolbar && (
        showInteractiveRuntime ? (
          <Toolbar
            editor={editor}
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
          editor={editor}
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
          editor={editor}
          className={floatingMenu?.className}
          locale={floatingMenu?.locale ?? locale}
          messages={floatingMenu?.messages ?? messages}
          icons={floatingMenu?.icons ?? icons}
          items={floatingMenu?.items}
        />
      )}

      {showInteractiveRuntime && showTableMenu && (
        <TableMenu
          editor={editor}
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
