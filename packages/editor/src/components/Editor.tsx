import { useMemo } from 'react';
import {
  Editor as CoreEditor,
  type EditorProps as CoreEditorProps,
} from '@inkio/core';
import { getDefaultExtensions, type DefaultExtensionsOptions } from '@inkio/advanced';

export type EditorProps = Omit<CoreEditorProps, 'extensions'> & {
  extensions?: CoreEditorProps['extensions'];
  defaultExtensionsOptions?: DefaultExtensionsOptions;
};

export function Editor({
  extensions,
  defaultExtensionsOptions,
  showToolbar = false,
  showBubbleMenu = true,
  showFloatingMenu = true,
  showTableMenu = true,
  ...props
}: EditorProps) {
  const resolvedExtensions = useMemo(
    () => extensions ?? getDefaultExtensions(defaultExtensionsOptions),
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
