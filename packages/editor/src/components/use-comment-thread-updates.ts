import { useEffect } from 'react';
import { notifyCommentThreadsChanged, type CommentConfig } from '@inkio/advanced';

/** Host thread data is external. A new lookup can mean an open thread needs to refresh. */
export function useCommentThreadUpdates(getComments: CommentConfig['getComments']) {
  useEffect(() => {
    if (getComments) notifyCommentThreadsChanged();
  }, [getComments]);
}
