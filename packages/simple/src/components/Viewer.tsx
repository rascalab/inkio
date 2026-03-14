import { useMemo } from 'react';
import {
  Viewer as CoreViewer,
  type ViewerProps as CoreViewerProps,
  type ExtensionsOptions,
  getExtensions,
} from '@inkio/core';

export type DefaultExtensionsOptions = ExtensionsOptions;

export type ViewerProps = Omit<CoreViewerProps, 'extensions'> & {
  extensions?: CoreViewerProps['extensions'];
  defaultExtensionsOptions?: DefaultExtensionsOptions;
};

export function Viewer({ extensions, defaultExtensionsOptions, ...props }: ViewerProps) {
  const resolvedExtensions = useMemo(
    () => extensions ?? getExtensions(defaultExtensionsOptions),
    [defaultExtensionsOptions, extensions],
  );

  return <CoreViewer {...({ ...props, extensions: resolvedExtensions } as CoreViewerProps)} />;
}
