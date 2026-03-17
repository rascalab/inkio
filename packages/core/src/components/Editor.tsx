'use client';

import { EditorContent, Extensions, JSONContent, Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useMemo, useState } from 'react';
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
  /** 에디터 컨테이너 스타일 */
  style?: React.CSSProperties;
  /** Fill the parent container height instead of sizing to content. */
  fill?: boolean;
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
  initialContent,
  extensions = [],
  placeholder,
  editable = true,
  onUpdate,
  onCreate,
  className = '',
  style,
  fill = false,
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

  const editor = useInkioEditor({
    ...(content !== undefined ? { content } : { initialContent }),
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
  const staticRender = useMemo(
    () => renderInkioStaticContent(initialContentValue, resolvedExtensions),
    [initialContentValue, resolvedExtensions],
  );
  const staticHtml = staticRender.html || (editable ? createEditorPlaceholderHtml(placeholder) : '<p></p>');
  const showInteractiveRuntime = isHydrated && !!editor;

  return (
    <div
      style={style}
      className={`inkio inkio-editor${fill ? ' inkio-editor--fill' : ''}${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
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
        <div className="tiptap inkio-editor-static-root" data-inkio-editor-static="">
          <div
            className="ProseMirror inkio-editor-static"
            dangerouslySetInnerHTML={{ __html: staticHtml }}
          />
        </div>
      )}
    </div>
  );
};
