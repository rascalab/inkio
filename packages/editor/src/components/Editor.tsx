import { EditorContent, Extensions, JSONContent, Editor as TiptapEditor } from '@tiptap/react';
import { useState } from 'react';
import type { InkioAdapter } from '../adapter';
import type { DefaultExtensionsFactory } from '../context/InkioProvider';
import { useInkioContext } from '../context/InkioProvider';
import { useInkioEditor } from '../hooks/useInkioEditor';
import type { InkioExtensionRegistry } from '../extensions/registry';
import { BubbleMenu } from './BubbleMenu';
import { FloatingMenu } from './FloatingMenu';
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
  showBubbleMenu = false,
  showFloatingMenu = false,
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
      {showBubbleMenu && (
        <BubbleMenu
          editor={editorInstance}
          locale={locale}
          messages={messages}
          icons={icons}
        />
      )}

      {showFloatingMenu && (
        <FloatingMenu
          editor={editorInstance}
          locale={locale}
          messages={messages}
          icons={icons}
        />
      )}

      <EditorContent editor={editor} />
    </div>
  );
};
