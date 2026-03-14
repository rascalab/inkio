import { useMemo } from 'react';
import {
  Editor as CoreEditor,
  type EditorProps as CoreEditorProps,
  type ExtensionsOptions,
  getExtensions,
} from '@inkio/core';

export type DefaultExtensionsOptions = ExtensionsOptions;

export type EditorProps = Omit<CoreEditorProps, 'extensions'> & {
  extensions?: CoreEditorProps['extensions'];
  defaultExtensionsOptions?: DefaultExtensionsOptions;
};

export function Editor({
  extensions,
  defaultExtensionsOptions,
  showToolbar = true,
  showBubbleMenu = false,
  showFloatingMenu = false,
  showTableMenu = true,
  ...props
}: EditorProps) {
  const resolvedExtensions = useMemo(
    () => extensions ?? getExtensions(defaultExtensionsOptions),
    [defaultExtensionsOptions, extensions],
  );

  const coreProps = {
    ...props,
    extensions: resolvedExtensions,
    showToolbar,
    showBubbleMenu,
    showFloatingMenu,
    showTableMenu,
  } as CoreEditorProps;

  return (
    <CoreEditor {...coreProps} />
  );
}
