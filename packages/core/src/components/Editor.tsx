import { EditorContent, Extensions, JSONContent, Editor as TiptapEditor } from '@tiptap/react';
import { useState } from 'react';
import type { InkioAdapter } from '../adapter';
import type { DefaultExtensionsFactory } from '../context/InkioProvider';
import { useInkioContext } from '../context/InkioProvider';
import { useInkioEditor } from '../hooks/useInkioEditor';
import type { InkioExtensionRegistry } from '../extensions/registry';
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
  extensionRegistry?: InkioExtensionRegistry;
  adapter?: InkioAdapter;
  /** Factory that returns the full extension set when adapter is provided. */
  getDefaultExtensions?: DefaultExtensionsFactory;
  placeholder?: string;
  editable?: boolean;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
  className?: string;
  /** 에디터 컨테이너 스타일 */
  style?: React.CSSProperties;
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
  extensionRegistry,
  adapter,
  getDefaultExtensions,
  placeholder,
  editable = true,
  onUpdate,
  onCreate,
  className = '',
  style,
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

  const ctx = useInkioContext();
  const resolvedAdapter = adapter ?? ctx.adapter;
  const resolvedFactory = getDefaultExtensions ?? ctx.getDefaultExtensions;

  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);

  const editor = useInkioEditor({
    ...(content !== undefined ? { content } : { initialContent }),
    extensions,
    extensionRegistry,
    adapter: resolvedAdapter,
    getDefaultExtensions: resolvedFactory,
    placeholder,
    editable,
    className,
    onUpdate,
    onCreate: (instance) => {
      setEditorInstance(instance);
      onCreate?.(instance);
    },
  });

  return (
    <div
      style={style}
      className={`inkio inkio-editor${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
    >
      {showToolbar && (
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
      )}

      {showBubbleMenu && (
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

      {showFloatingMenu && (
        <FloatingMenu
          editor={editorInstance}
          className={floatingMenu?.className}
          locale={floatingMenu?.locale ?? locale}
          messages={floatingMenu?.messages ?? messages}
          icons={floatingMenu?.icons ?? icons}
          items={floatingMenu?.items}
        />
      )}

      {showTableMenu && (
        <TableMenu
          editor={editorInstance}
          className={tableMenu?.className}
          locale={tableMenu?.locale ?? locale}
          messages={tableMenu?.messages ?? messages}
          icons={tableMenu?.icons ?? icons}
        />
      )}

      <EditorContent editor={editor} />
    </div>
  );
};
