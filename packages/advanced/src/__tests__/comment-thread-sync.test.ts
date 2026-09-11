import { COMMENT_THREADS_CHANGED_EVENT, notifyCommentThreadsChanged } from '../comment/Comment';

describe('comment thread sync event', () => {
  it('notifies open surfaces when thread data changes', () => {
    const handler = vi.fn();
    window.addEventListener(COMMENT_THREADS_CHANGED_EVENT, handler);
    try {
      notifyCommentThreadsChanged();
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(COMMENT_THREADS_CHANGED_EVENT, handler);
    }
  });
});
