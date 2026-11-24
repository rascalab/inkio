'use client';

import { useMemo, useState } from 'react';
import {
  Editor as CoreEditor,
  type EditorProps as CoreEditorProps,
  type WithEditorExtensions,
  type InkioLocaleInput,
  type InkioEditorUiOptions,
  type InkioErrorHandler,
  type ExtensionsOptions,
  type ImageUploadContext,
  getExtensions,
} from '@inkio/core';
import type { InkioJSONContent as JSONContent } from '@inkio/core';
import type { ExtensionsInput } from '../types';
import { mapEditorUiToCoreProps, mergeImageBlockOptions, resolveExtensionsInput, useStableExtensions, useStableProps } from '@inkio/core';

export interface EditorProps {
  /** Initial document only (uncontrolled). */
  content?: string | JSONContent;
  editable?: boolean;
  placeholder?: string;
  /** Accessible name of the editing surface. */
  ariaLabel?: string;
  locale?: InkioLocaleInput;
  /** Color theme */
  theme?: 'light' | 'dark';
  tabBehavior?: 'indent' | 'default';
  onUpdate?: (content: JSONContent) => void;
  onChange?: CoreEditorProps['onChange'];
  onCreate?: CoreEditorProps['onCreate'];

  ui?: InkioEditorUiOptions;

  onImageUpload?: (file: File, context: ImageUploadContext) => Promise<string | { src: string; [key: string]: unknown }>;
  imageBlock?: Omit<Partial<import('@inkio/core').ImageBlockOptions>, 'onUpload' | 'HTMLAttributes'>;
  onError?: InkioErrorHandler;

  extensions?: ExtensionsInput;
};

export function Editor<const Input extends EditorProps['extensions']>(props: WithEditorExtensions<EditorProps, Input>): React.JSX.Element;
export function Editor(props: EditorProps): React.JSX.Element;
export function Editor({
  content,
  editable,
  placeholder,
  ariaLabel,
  locale,
  theme,
  tabBehavior,
  onChange,
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
  // Only where the extensions start: `CoreEditor` keeps the live editor up to date
  // with later changes, so the document, caret and undo history stay.
  const [firstUi] = useState(() => ({ placeholder, locale, messages: stableUi.messages, icons: stableUi.icons }));
  const imageEditor = imageBlock?.imageEditor;
  const extensionInputs = useStableProps({
    tabBehavior,
    imageBlock: imageBlock && { ...imageBlock, imageEditor: undefined },
    onImageUpload,
    onError,
  });
  const stableExtensions = useStableExtensions(extensions);

  const resolvedExtensions = useMemo(() => {
    const opts: ExtensionsOptions = {
      ...firstUi,
      tabBehavior: extensionInputs.tabBehavior,
    };
    const mergedImageBlock = mergeImageBlockOptions(extensionInputs.imageBlock, {
      onUpload: extensionInputs.onImageUpload,
      onError: extensionInputs.onError,
    });
    if (mergedImageBlock) {
      opts.imageBlock = { ...mergedImageBlock, imageEditor };
    }
    return { items: resolveExtensionsInput(stableExtensions, () => getExtensions(opts)), replace: true };
  }, [extensionInputs, stableExtensions, firstUi, imageEditor]);

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
    ariaLabel,
    theme,
    onChange,
    onUpdate,
    onCreate,
    locale,
  };

  return <CoreEditor {...coreProps} />;
}
