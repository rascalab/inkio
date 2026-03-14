import { useMemo } from 'react';
import {
  Viewer as CoreViewer,
  type ViewerProps as CoreViewerProps,
} from '@inkio/core';
import { getDefaultExtensions, type DefaultExtensionsOptions } from '@inkio/advanced';

export type ViewerProps = Omit<CoreViewerProps, 'extensions'> & {
  extensions?: CoreViewerProps['extensions'];
  defaultExtensionsOptions?: DefaultExtensionsOptions;
};

export function Viewer({ extensions, defaultExtensionsOptions, ...props }: ViewerProps) {
  const resolvedExtensions = useMemo(
    () => extensions ?? getDefaultExtensions(defaultExtensionsOptions),
    [defaultExtensionsOptions, extensions],
  );

  return <CoreViewer {...({ ...props, extensions: resolvedExtensions } as CoreViewerProps)} />;
}
