import React from 'react';
import type { CommentThread, InkioCommentAdapter } from './CommentThread';

export interface CommentSidebarProps {
  threads: CommentThread[];
  activeThreadId?: string;
  adapter?: InkioCommentAdapter;
  onThreadClick?: (id: string) => void;
}



const formatTimestamp = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export function CommentSidebar({
  threads,
  activeThreadId,
  adapter,
  onThreadClick,
}: CommentSidebarProps) {
  const [reply, setReply] = React.useState('');

  const activeThread = React.useMemo(
    () => threads.find((thread) => thread.id === activeThreadId),
    [threads, activeThreadId]
  );

  React.useEffect(() => {
    setReply('');
  }, [activeThreadId]);

  const submitReply = React.useCallback(() => {
    if (!activeThread || !adapter?.onCommentReply) {
      return;
    }

    const content = reply.trim();

    if (!content) {
      return;
    }

    adapter.onCommentReply(activeThread.id, content);
    setReply('');
  }, [activeThread, adapter, reply]);

  return (
    <aside className="inkio-comment-sidebar">
      <header className="inkio-comment-sidebar-header">Comments</header>

      <div className="inkio-comment-sidebar-list">
        {threads.length === 0 ? (
          <div className="inkio-comment-sidebar-empty">No comment threads yet.</div>
        ) : (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const latestComment = thread.comments[thread.comments.length - 1];

            return (
              <div
                key={thread.id}
                className={`inkio-comment-sidebar-card ${isActive ? 'is-active' : ''} ${thread.resolved ? 'is-resolved' : ''}`}
                onClick={() => onThreadClick?.(thread.id)}
              >
                <div className="inkio-comment-sidebar-meta">
                  <span className="inkio-comment-sidebar-author">{latestComment?.author.name ?? 'Unknown author'}</span>
                  <span className="inkio-comment-sidebar-time">
                    {formatTimestamp(latestComment?.createdAt ?? thread.createdAt)}
                  </span>
                </div>

                {thread.resolved ? <span className="inkio-comment-sidebar-status">Resolved</span> : null}

                <p className="inkio-comment-sidebar-preview">
                  {latestComment?.content ?? 'No comments in this thread yet.'}
                </p>

                <div className="inkio-comment-sidebar-actions">
                  <button
                    type="button"
                    className="inkio-comment-sidebar-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      adapter?.onCommentResolve?.(thread.id);
                    }}
                  >
                    Resolve
                  </button>

                  <button
                    type="button"
                    className="inkio-comment-sidebar-btn is-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      adapter?.onCommentDelete?.(thread.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer className="inkio-comment-sidebar-reply">
        <div className="inkio-comment-sidebar-reply-title">
          {activeThread ? `Reply to ${activeThread.id}` : 'Select a thread to reply'}
        </div>

        <textarea
          value={reply}
          className="inkio-comment-sidebar-reply-input"
          placeholder="Write a reply..."
          disabled={!activeThread}
          onChange={(event) => setReply(event.target.value)}
        />

        <button
          type="button"
          className="inkio-comment-sidebar-reply-btn"
          disabled={!activeThread || !reply.trim()}
          onClick={submitReply}
        >
          Reply
        </button>
      </footer>
    </aside>
  );
}
