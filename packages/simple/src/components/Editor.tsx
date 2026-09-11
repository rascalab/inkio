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
import type { InkioJSONContent as JSONContent } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ExtensionsInput } from '../types';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';
import { useStableOptions } from '../utils/stable-options';

type EditorContentMode =
  | { content: string | JSONContent; initialContent?: never }
  | { content?: never; initialContent?: string | JSONContent };

export type EditorProps = EditorContentMode & {
  editable?: boolean;
  placeholder?: string;
  locale?: InkioLocaleInput;
  /** Color theme */
  theme?: 'light' | 'dark';
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
  theme,
  tabBehavior,
  onUpdate,
  onCreate,
  ui,
  onImageUpload,
  imageBlock,
  onError,
  extensions,
}: EditorProps) {
  // Inline option literals from a re-rendering parent must not rebuild the
  // extension set (tiptap compares extensions by identity → setOptions storm
  // per keystroke). Structural inputs are stabilized; callbacks still compare
  // by reference so updates are never swallowed.
  const stableImageBlock = useStableOptions(imageBlock);
  const stableMessages = useStableOptions(ui?.messages);
  const stableIcons = useStableOptions(ui?.icons);
  const stableToolbar = useStableOptions(ui?.toolbar);
  const stableBubbleMenu = useStableOptions(ui?.bubbleMenu);
  const stableFloatingMenu = useStableOptions(ui?.floatingMenu);
  const stableTableMenu = useStableOptions(ui?.tableMenu);

  const coreExtensionOptions = useMemo<ExtensionsOptions>(() => {
    const opts: ExtensionsOptions = {
      placeholder,
      tabBehavior,
    };

    if (onImageUpload !== undefined || stableImageBlock !== undefined || onError !== undefined) {
      opts.imageBlock = { ...stableImageBlock, ...(onImageUpload ? { onUpload: onImageUpload } : {}), ...(onError ? { onError } : {}) };
    }

    return opts;
  }, [placeholder, tabBehavior, onImageUpload, stableImageBlock, onError]);

  const resolvedExtensions = useMemo(() => {
    const defaults = getExtensions(coreExtensionOptions);
    return resolveExtensionsInput(extensions, defaults);
  }, [coreExtensionOptions, extensions]);

  const coreProps: CoreEditorProps = useMemo(() => ({
    ...(content !== undefined ? { content } : { initialContent }),
    extensions: resolvedExtensions,
    editable,
    placeholder,
    theme,
    onUpdate,
    onCreate,
    locale,
    messages: stableMessages,
    icons: stableIcons,
    className: ui?.className,
    style: ui?.style,
    fill: ui?.fill,
    autoresize: ui?.autoresize,
    bordered: ui?.bordered,
    showToolbar: ui?.showToolbar ?? true,
    showBubbleMenu: ui?.showBubbleMenu ?? false,
    showFloatingMenu: ui?.showFloatingMenu ?? false,
    showTableMenu: ui?.showTableMenu ?? true,
    toolbar: stableToolbar,
    bubbleMenu: stableBubbleMenu,
    floatingMenu: stableFloatingMenu,
    tableMenu: stableTableMenu,
  }), [
    content,
    initialContent,
    resolvedExtensions,
    editable,
    placeholder,
    theme,
    onUpdate,
    onCreate,
    locale,
    stableMessages,
    stableIcons,
    ui?.className,
    ui?.style,
    ui?.fill,
    ui?.autoresize,
    ui?.bordered,
    ui?.showToolbar,
    ui?.showBubbleMenu,
    ui?.showFloatingMenu,
    ui?.showTableMenu,
    stableToolbar,
    stableBubbleMenu,
    stableFloatingMenu,
    stableTableMenu,
  ]);

  return <CoreEditor {...coreProps} />;
}
