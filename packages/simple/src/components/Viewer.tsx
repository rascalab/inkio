'use client';

import { InteractiveViewer, type InteractiveViewerProps, type WithEditorExtensions } from '@inkio/core';

export type ViewerProps = InteractiveViewerProps;

export function Viewer<const Input extends ViewerProps['extensions']>(props: WithEditorExtensions<ViewerProps, Input>): React.JSX.Element;
export function Viewer(props: ViewerProps): React.JSX.Element;
export function Viewer(props: ViewerProps) {
  return <InteractiveViewer {...props} />;
}
