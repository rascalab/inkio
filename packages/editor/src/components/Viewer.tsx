'use client';

import { useMemo } from 'react';
import { InteractiveViewer, useStableProps, type InteractiveViewerProps, type WithEditorExtensions } from '@inkio/core';
import { getAdvancedViewerExtensions, type CommentData } from '@inkio/advanced';
import { useCommentThreadUpdates } from './use-comment-thread-updates';

interface ViewerCommentOptions {
  getComments: (commentId: string) => CommentData | null;
}

export type ViewerProps = InteractiveViewerProps & {
  comment?: ViewerCommentOptions;
};

export function Viewer<const Input extends ViewerProps['extensions']>(props: WithEditorExtensions<ViewerProps, Input>): React.JSX.Element;
export function Viewer(props: ViewerProps): React.JSX.Element;
export function Viewer({ comment, ...props }: ViewerProps) {
  const stable = useStableProps({ comment });
  const presetExtensions = useMemo(() => getAdvancedViewerExtensions(stable.comment), [stable]);
  useCommentThreadUpdates(comment?.getComments);
  return <InteractiveViewer {...props} presetExtensions={presetExtensions} />;
}
