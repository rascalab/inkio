import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  formatRelativeTime,
  useInkioCommentUi,
  type InkioCommentMessageOverrides,
} from '../../i18n';
import { getInitials } from '../utils';

// ─── Data types ────────────────────────────────────────────

export interface CommentMessage {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface CommentThreadData {
  id: string;
  messages: CommentMessage[];
  resolved: boolean;
}

/** Highlight range found in the editor document */
interface EditorCommentMark {
  commentId: string;
  text: string;
  from: number;
  to: number;
  resolved: boolean;
}

// ─── Props ─────────────────────────────────────────────────

export interface CommentPanelProps {
  /** Tiptap Editor instance */
  editor: Editor | null;
  /** Externally managed comment thread data */
  threads: CommentThreadData[];
  /** Called when user submits a reply to a thread */
  onReply: (commentId: string, text: string) => void;
  /** Called to resolve a thread */
  onResolve: (commentId: string) => void;
  /** Called to delete a thread (removes mark + data) */
  onDelete: (commentId: string) => void;
  /** Current user display name */
  currentUser?: string;
  /** ID of the thread to highlight and scroll to */
  activeThreadId?: string | null;
  /** Additional class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
  locale?: InkioLocaleInput;
  /** Message overrides for extension comment labels */
  messages?: InkioCommentMessageOverrides | InkioMessageOverrides;
  /** Reserved icon overrides */
  icons?: Partial<InkioIconRegistry>;
}

// ─── Helpers ───────────────────────────────────────────────

function collectEditorMarks(editor: Editor): EditorCommentMark[] {
  const marks = new Map<string, EditorCommentMark>();
  const markType = editor.state.schema.marks.comment;
  if (!markType) return [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;

    for (const mark of node.marks) {
      if (mark.type !== markType) continue;

      const commentId = mark.attrs.commentId as string;
      if (!commentId) continue;

      const existing = marks.get(commentId);
      if (existing) {
        existing.to = Math.max(existing.to, pos + node.nodeSize);
        existing.text += node.text || '';
      } else {
        marks.set(commentId, {
          commentId,
          text: node.text || '',
          resolved: Boolean(mark.attrs.resolved),
          from: pos,
          to: pos + node.nodeSize,
        });
      }
    }
  });

  return Array.from(marks.values());
}

// ─── Component ─────────────────────────────────────────────

export const CommentPanel = ({
  editor,
  threads,
  onReply,
  onResolve,
  onDelete,
  currentUser,
  activeThreadId,
  className,
  style,
  locale,
  messages,
  icons,
}: CommentPanelProps) => {
  const [editorMarks, setEditorMarks] = useState<EditorCommentMark[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const threadRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to externally activated thread
  useEffect(() => {
    setActiveThread(activeThreadId ?? null);
    if (!activeThreadId) return;
    const el = threadRefs.current.get(activeThreadId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeThreadId]);
  const ui = useInkioCommentUi({
    locale,
    messages,
    icons,
  });

  const formatTimeAgo = useCallback(
    (value: Date): string => {
      const diff = Date.now() - value.getTime();
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) return ui.messages.commentPanel.time.justNow;

      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) {
        return formatRelativeTime(ui.messages.commentPanel.time.minutesAgo, minutes);
      }

      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return formatRelativeTime(ui.messages.commentPanel.time.hoursAgo, hours);
      }

      const days = Math.floor(hours / 24);
      return formatRelativeTime(ui.messages.commentPanel.time.daysAgo, days);
    },
    [ui.messages.commentPanel.time.daysAgo, ui.messages.commentPanel.time.hoursAgo, ui.messages.commentPanel.time.justNow, ui.messages.commentPanel.time.minutesAgo],
  );

  useEffect(() => {
    if (!editor) return;

    let lastDoc = editor.state.doc;
    setEditorMarks(collectEditorMarks(editor));

    const refresh = () => {
      if (editor.state.doc !== lastDoc) {
        lastDoc = editor.state.doc;
        setEditorMarks(collectEditorMarks(editor));
      }
    };

    editor.on('transaction', refresh);
    return () => {
      editor.off('transaction', refresh);
    };
  }, [editor]);

  const handleScrollTo = useCallback(
    (mark: EditorCommentMark) => {
      if (!editor) return;

      editor.chain().focus().setTextSelection({ from: mark.from, to: mark.to }).run();
      const { node } = editor.view.domAtPos(mark.from);
      (node as HTMLElement)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    },
    [editor],
  );

  const replyTextsRef = useRef(replyTexts);
  replyTextsRef.current = replyTexts;

  const handleReply = useCallback(
    (commentId: string) => {
      const text = (replyTextsRef.current[commentId] || '').trim();
      if (!text) return;

      onReply(commentId, text);
      setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
    },
    [onReply],
  );

  const handleDeleteThread = useCallback(
    (commentId: string) => {
      if (!editor) return;

      const mark = editorMarks.find((item) => item.commentId === commentId);
      if (mark) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: mark.from, to: mark.to })
          .unsetMark('comment')
          .run();
      }

      onDelete(commentId);
    },
    [editor, editorMarks, onDelete],
  );

  const displayThreads = useMemo(() => {
    return editorMarks
      .map((mark) => {
        const threadData = threads.find((thread) => thread.id === mark.commentId);
        return { mark, threadData };
      })
      .filter(({ threadData }) => {
        if (filter === 'open') return threadData && !threadData.resolved;
        if (filter === 'resolved') return threadData && threadData.resolved;
        return true;
      });
  }, [editorMarks, threads, filter]);

  if (!editor) return null;

  const hasCommentExtension = editor.extensionManager.extensions.some(
    (extension) => extension.name === 'comment',
  );
  if (!hasCommentExtension) return null;

  const resolvedCurrentUser = currentUser || ui.messages.commentPanel.you;
  const openCount = threads.filter((thread) => !thread.resolved).length;
  const resolvedCount = threads.filter((thread) => thread.resolved).length;

  return (
    <div className={`inkio inkio-comment-panel ${className || ''}`} style={style}>
      <div className="inkio-comment-panel-header">
        <h3 className="inkio-comment-panel-title">
          {ui.messages.commentPanel.title}
          {openCount > 0 && <span className="inkio-comment-badge">{openCount}</span>}
        </h3>
      </div>

      <div className="inkio-comment-filters">
        <button
          type="button"
          className={`inkio-comment-filter-btn ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {ui.messages.commentPanel.all} ({editorMarks.length})
        </button>
        <button
          type="button"
          className={`inkio-comment-filter-btn ${filter === 'open' ? 'is-active' : ''}`}
          onClick={() => setFilter('open')}
        >
          {ui.messages.commentPanel.open} ({openCount})
        </button>
        <button
          type="button"
          className={`inkio-comment-filter-btn ${filter === 'resolved' ? 'is-active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          {ui.messages.commentPanel.resolved} ({resolvedCount})
        </button>
      </div>

      {displayThreads.length === 0 ? (
        <div className="inkio-comment-empty">
          {editorMarks.length === 0
            ? ui.messages.commentPanel.emptyNoComments
            : ui.messages.commentPanel.emptyNoMatch}
        </div>
      ) : (
        <div className="inkio-comment-list">
          {displayThreads.map(({ mark, threadData }) => {
            const isActive = activeThread === mark.commentId;
            const isResolved = threadData?.resolved ?? mark.resolved;

            return (
              <div
                key={mark.commentId}
                ref={(el) => {
                  if (el) threadRefs.current.set(mark.commentId, el);
                  else threadRefs.current.delete(mark.commentId);
                }}
                className={`inkio-comment-thread ${isResolved ? 'is-resolved' : ''} ${isActive ? 'is-active' : ''}`}
              >
                <div
                  className="inkio-comment-thread-quote"
                  onClick={() => handleScrollTo(mark)}
                  title={ui.messages.commentPanel.quoteHint}
                >
                  <div className="inkio-comment-quote-bar" />
                  <span className="inkio-comment-quote-text">
                    {mark.text.length > 100 ? `${mark.text.slice(0, 100)}…` : mark.text}
                  </span>
                </div>

                {threadData && threadData.messages.length > 0 ? (
                  <div className="inkio-comment-messages">
                    {threadData.messages.map((msg) => (
                      <div key={msg.id} className="inkio-comment-msg">
                        <div className="inkio-comment-msg-avatar">
                          {getInitials(msg.author || resolvedCurrentUser)}
                        </div>
                        <div className="inkio-comment-msg-body">
                          <div className="inkio-comment-msg-header">
                            <span className="inkio-comment-msg-author">{msg.author || resolvedCurrentUser}</span>
                            <span className="inkio-comment-msg-time">{formatTimeAgo(msg.createdAt)}</span>
                          </div>
                          <div className="inkio-comment-msg-text">{msg.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inkio-comment-no-messages">
                    {ui.messages.commentPanel.noMessages}
                  </div>
                )}

                {!isResolved && (
                  <div className="inkio-comment-reply-row">
                    <input
                      type="text"
                      className="inkio-comment-reply-input"
                      placeholder={ui.messages.commentPanel.replyPlaceholder}
                      value={replyTexts[mark.commentId] || ''}
                      onChange={(event) =>
                        setReplyTexts((prev) => ({ ...prev, [mark.commentId]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleReply(mark.commentId);
                        }
                      }}
                      onFocus={() => setActiveThread(mark.commentId)}
                    />
                    {(replyTexts[mark.commentId] || '').trim() && (
                      <button
                        type="button"
                        className="inkio-comment-reply-send"
                        onClick={() => handleReply(mark.commentId)}
                      >
                        ↵
                      </button>
                    )}
                  </div>
                )}

                <div className="inkio-comment-thread-actions">
                  {!isResolved && (
                    <button
                      type="button"
                      className="inkio-comment-action-btn resolve"
                      onClick={() => {
                        (editor.commands as { resolveComment?: (commentId: string) => void }).resolveComment?.(mark.commentId);
                        onResolve(mark.commentId);
                      }}
                    >
                      ✓ {ui.messages.commentPanel.resolve}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inkio-comment-action-btn delete"
                    onClick={() => handleDeleteThread(mark.commentId)}
                  >
                    ✕ {ui.messages.commentPanel.delete}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
