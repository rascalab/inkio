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
import { mapEditorUiToCoreProps, mergeImageBlockOptions, useStableProps } from '@inkio/core';

export interface EditorProps {
  /** Initial document only (uncontrolled). */
  content?: string | JSONContent;
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
  // per keystroke). Structural inputs are stabilized; callbacks become
  // stable forwarders to the latest implementation.
  const stableUi = useStableProps(ui ?? {});
  const extensionInputs = useStableProps({
    placeholder,
    tabBehavior,
    imageBlock,
    onImageUpload,
    onError,
  });

  const resolvedExtensions = useMemo(() => {
    const opts: ExtensionsOptions = {
      placeholder: extensionInputs.placeholder,
      tabBehavior: extensionInputs.tabBehavior,
    };
    const mergedImageBlock = mergeImageBlockOptions(extensionInputs.imageBlock, {
      onUpload: extensionInputs.onImageUpload,
      onError: extensionInputs.onError,
    });
    if (mergedImageBlock) {
      opts.imageBlock = mergedImageBlock;
    }
    return resolveExtensionsInput(extensions, getExtensions(opts));
  }, [extensionInputs, extensions]);

  const coreProps: CoreEditorProps = {
    ...mapEditorUiToCoreProps(stableUi, {
      showToolbar: true,
      showBubbleMenu: false,
      showFloatingMenu: false,
      showTableMenu: true,
    }),
    content,
    extensions: resolvedExtensions,
    editable,
    placeholder,
    theme,
    onUpdate,
    onCreate,
    locale,
  };

  return <CoreEditor {...coreProps} />;
}
