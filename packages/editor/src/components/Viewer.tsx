import { useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent, Extensions, JSONContent } from '@tiptap/react';
import type { InkioAdapter } from '../adapter';
import type { DefaultExtensionsFactory } from '../context/InkioProvider';
import { useInkioContext } from '../context/InkioProvider';
import { getDefaultCoreExtensions } from '../extensions/defaults';
import type { InkioExtensionRegistry } from '../extensions/registry';

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
}: ViewerProps) {
  if (content !== undefined && initialContent !== undefined) {
    throw new Error('Inkio Viewer: `content` and `initialContent` cannot be used together.');
  }

  const ctx = useInkioContext();
  const resolvedAdapter = adapter ?? ctx.adapter;
  const resolvedFactory = getDefaultExtensions ?? ctx.getDefaultExtensions;

  const viewerContent = content ?? initialContent ?? '';

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
      ...getDefaultCoreExtensions({ placeholder }),
      ...(extensionRegistry?.getExtensions() ?? []),
    ] as Extensions;
  }, [extensions, resolvedAdapter, resolvedFactory, extensionRegistry, placeholder]);

  const isMountedRef = useRef(true);
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
          }
        });
      }
    }
  }, [editor, content]);

  return (
    <div
      style={style}
      className={`inkio inkio-viewer${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
