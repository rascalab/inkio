'use client';

import { useMemo } from 'react';
import {
  Editor as CoreEditor,
  type EditorProps as CoreEditorProps,
  type TiptapEditor,
  type InkioLocaleInput,
  type InkioMessageOverrides,
  type InkioErrorHandler,
  type ExtensionsOptions,
  getExtensions,
} from '@inkio/core';
import type { ToolbarProps } from '@inkio/core';
import type { BubbleMenuProps } from '@inkio/core';
import type { FloatingMenuProps } from '@inkio/core';
import type { TableMenuProps } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ExtensionsInput } from '../types';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';

type JSONContent = NonNullable<CoreEditorProps['content']> extends string | infer J ? J : never;

type EditorContentMode =
  | { content: string | JSONContent; initialContent?: never }
  | { content?: never; initialContent?: string | JSONContent };

export type EditorProps = EditorContentMode & {
  editable?: boolean;
  placeholder?: string;
  locale?: InkioLocaleInput;
  tabBehavior?: 'indent' | 'default';
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;

  ui?: {
    className?: string;
    style?: React.CSSProperties;
    fill?: boolean;
    autoresize?: boolean;
    bordered?: boolean;
    showToolbar?: boolean;
    showBubbleMenu?: boolean;
    showFloatingMenu?: boolean;
    showTableMenu?: boolean;
    toolbar?: Omit<ToolbarProps, 'editor'>;
    bubbleMenu?: Omit<BubbleMenuProps, 'editor'>;
    floatingMenu?: Omit<FloatingMenuProps, 'editor'>;
    tableMenu?: Omit<TableMenuProps, 'editor'>;
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };

  onImageUpload?: (file: File) => Promise<string | { src: string; [key: string]: unknown }>;
  imageBlock?: Omit<Partial<import('@inkio/core').ImageBlockOptions>, 'onUpload' | 'HTMLAttributes'>;
  onError?: InkioErrorHandler;

  extensions?: ExtensionsInput;
};

export function Editor({
  content,
  initialContent,
  editable,
  placeholder,
  locale,
  tabBehavior,
  onUpdate,
  onCreate,
  ui,
  onImageUpload,
  imageBlock,
  onError,
  extensions,
}: EditorProps) {
  const coreExtensionOptions = useMemo<ExtensionsOptions>(() => {
    const opts: ExtensionsOptions = {
      placeholder,
      tabBehavior,
    };

    if (onImageUpload !== undefined || imageBlock !== undefined || onError !== undefined) {
      opts.imageBlock = { ...imageBlock, ...(onImageUpload ? { onUpload: onImageUpload } : {}), ...(onError ? { onError } : {}) };
    }

    return opts;
  }, [placeholder, tabBehavior, onImageUpload, imageBlock, onError]);

  const resolvedExtensions = useMemo(() => {
    const defaults = getExtensions(coreExtensionOptions);
    return resolveExtensionsInput(extensions, defaults);
  }, [coreExtensionOptions, extensions]);

  const coreProps: CoreEditorProps = {
    ...(content !== undefined ? { content } : { initialContent }),
    extensions: resolvedExtensions,
    editable,
    placeholder,
    onUpdate,
    onCreate,
    locale,
    messages: ui?.messages,
    icons: ui?.icons,
    className: ui?.className,
    style: ui?.style,
    fill: ui?.fill,
    autoresize: ui?.autoresize,
    bordered: ui?.bordered,
    showToolbar: ui?.showToolbar ?? true,
    showBubbleMenu: ui?.showBubbleMenu ?? false,
    showFloatingMenu: ui?.showFloatingMenu ?? false,
    showTableMenu: ui?.showTableMenu ?? true,
    toolbar: ui?.toolbar,
    bubbleMenu: ui?.bubbleMenu,
    floatingMenu: ui?.floatingMenu,
    tableMenu: ui?.tableMenu,
  };

  return <CoreEditor {...coreProps} />;
}
