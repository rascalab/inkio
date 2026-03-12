import { useState, useEffect, useCallback } from 'react';
import type { CommentThread, InkioCommentAdapter } from './CommentThread';

export interface CommentPopoverProps {
  thread?: CommentThread;
  position: { top: number; left: number };
  adapter?: InkioCommentAdapter;
  onClose?: () => void;
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const CommentPopover = ({
  thread,
  position,
  adapter,
  onClose,
}: CommentPopoverProps) => {
  const [reply, setReply] = useState('');

  useEffect(() => {
    setReply('');
  }, [thread?.id]);

  const submitReply = useCallback(() => {
    if (!thread || !adapter?.onCommentReply) {
      return;
    }

    const content = reply.trim();

    if (!content) {
      return;
    }

    adapter.onCommentReply(thread.id, content);
    setReply('');
  }, [thread, adapter, reply]);

  if (!thread) {
    return null;
  }

  return (
    <div
      className="inkio-comment-popover"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <header className="inkio-comment-popover-header">
        <span className="inkio-comment-popover-title">Thread {thread.id}</span>
        <button type="button" className="inkio-comment-popover-close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="inkio-comment-popover-body">
        {thread.comments.length === 0 ? (
          <div className="inkio-comment-popover-empty">No comments yet.</div>
        ) : (
          thread.comments.map((comment) => (
            <article key={comment.id} className="inkio-comment-popover-card">
              <div className="inkio-comment-popover-meta">
                <span className="inkio-comment-popover-author">{comment.author.name}</span>
                <span className="inkio-comment-popover-time">{formatTimestamp(comment.createdAt)}</span>
              </div>

              <p className="inkio-comment-popover-content">{comment.content}</p>
            </article>
          ))
        )}

        <div className="inkio-comment-popover-actions">
          <button
            type="button"
            className="inkio-comment-popover-action-btn"
            onClick={() => adapter?.onCommentResolve?.(thread.id)}
          >
            Resolve
          </button>
          <button
            type="button"
            className="inkio-comment-popover-action-btn"
            onClick={() => adapter?.onCommentDelete?.(thread.id)}
          >
            Delete
          </button>
        </div>
      </div>

      <footer className="inkio-comment-popover-footer">
        <textarea
          value={reply}
          className="inkio-comment-popover-reply-input"
          placeholder="Write a reply..."
          onChange={(event) => setReply(event.target.value)}
        />
        <button
          type="button"
          className="inkio-comment-popover-reply-btn"
          disabled={!reply.trim()}
          onClick={submitReply}
        >
          Reply
        </button>
      </footer>
    </div>
  );
};
