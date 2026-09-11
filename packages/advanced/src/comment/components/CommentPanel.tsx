import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  formatRelativeTime,
  useInkioCommentUi,
  type InkioCommentMessageOverrides,
} from '../i18n';
import { getInitials } from '../utils';
import { notifyCommentThreadsChanged } from '../Comment';

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
  /** All contiguous ranges for this id. from/to mirror ranges[0] for compat. */
  ranges: Array<{ from: number; to: number }>;
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

/**
 * Semantic equality for comment marks. Absolute positions shift on every
 * keystroke before a mark, so compare text + resolved + range shapes only —
 * typing elsewhere must not re-render the panel.
 */
function isSameEditorMarks(a: EditorCommentMark[], b: EditorCommentMark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((mark, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      mark.commentId === other.commentId &&
      mark.text === other.text &&
      mark.resolved === other.resolved &&
      mark.ranges.length === other.ranges.length &&
      mark.ranges.every(
        (range, rangeIndex) =>
          range.to - range.from === other.ranges[rangeIndex].to - other.ranges[rangeIndex].from,
      )
    );
  });
}

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

      const from = pos;
      const to = pos + node.nodeSize;
      const existing = marks.get(commentId);
      if (existing) {
        // Only merge directly contiguous runs. Non-contiguous same-id ranges
        // stay separate so scroll-to never selects the gap text between them.
        const last = existing.ranges[existing.ranges.length - 1];
        if (last && last.to === from && existing.resolved === Boolean(mark.attrs.resolved)) {
          last.to = to;
          existing.to = to;
        } else {
          existing.ranges.push({ from, to });
        }
        existing.text += node.text || '';
      } else {
        marks.set(commentId, {
          commentId,
          text: node.text || '',
          resolved: Boolean(mark.attrs.resolved),
          from,
          to,
          ranges: [{ from, to }],
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

  // Let the open thread popover re-read thread data: external `threads`
  // updates don't produce document transactions, so without this the popover
  // would keep showing stale messages.
  useEffect(() => {
    notifyCommentThreadsChanged();
  }, [threads]);

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
    (value: Date | string | number): string => {
      const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
      if (Number.isNaN(time)) return ui.messages.commentPanel.time.justNow;
      const diff = Date.now() - time;
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
        const next = collectEditorMarks(editor);
        // Typing elsewhere shifts positions but usually leaves the mark set
        // identical — keep the previous array identity so the panel (and its
        // subtree) doesn't re-render on every keystroke.
        setEditorMarks((prev) => (isSameEditorMarks(prev, next) ? prev : next));
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

      // Select the first contiguous range only — never the gap between
      // non-contiguous same-id runs.
      const target = mark.ranges[0] ?? { from: mark.from, to: mark.to };
      editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).run();
      const { node } = editor.view.domAtPos(target.from);
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
        // Remove every contiguous range, not just the first span.
        const tr = editor.state.tr;
        const markType = editor.state.schema.marks.comment;
        if (markType) {
          for (const range of mark.ranges) {
            tr.removeMark(range.from, range.to, markType);
          }
          editor.view.dispatch(tr);
        }
      }

      onDelete(commentId);
    },
    [editor, editorMarks, onDelete],
  );

  /**
   * Single source of truth for resolution: the document mark is always
   * updated via the `resolveComment` command (which fires the extension's
   * `onCommentResolve`), and the panel consumer is notified via `onResolve`.
   * When both props are the same function reference (the common wiring), the
   * consumer callback is skipped to avoid a double-call.
   */
  const handleResolveThread = useCallback(
    (commentId: string) => {
      if (!editor) return;
      const commentExtension = editor.extensionManager.extensions.find(
        (extension) => extension.name === 'comment',
      ) as { options?: { onCommentResolve?: (commentId: string) => void } } | undefined;
      (editor.commands as { resolveComment?: (commentId: string) => void }).resolveComment?.(commentId);
      if (onResolve !== commentExtension?.options?.onCommentResolve) {
        onResolve(commentId);
      }
    },
    [editor, onResolve],
  );

  const isResolvedMark = useCallback(
    (mark: EditorCommentMark, threadData: { resolved: boolean } | undefined) =>
      threadData?.resolved ?? mark.resolved,
    [],
  );

  interface PanelRow {
    commentId: string;
    /** Null for orphan threads (external data without a document mark). */
    mark: EditorCommentMark | null;
    threadData: CommentThreadData | undefined;
    resolved: boolean;
    /** Quote text: doc mark text, else first message, else empty. */
    quoteText: string;
  }

  const allRows = useMemo<PanelRow[]>(() => {
    const rows: PanelRow[] = editorMarks.map((mark) => {
      const threadData = threads.find((thread) => thread.id === mark.commentId);
      return {
        commentId: mark.commentId,
        mark,
        threadData,
        resolved: isResolvedMark(mark, threadData),
        quoteText: mark.text,
      };
    });
    // Orphans: external threads whose document mark is gone (deleted text,
    // loaded doc without marks). Render them from thread data so the panel
    // never desyncs from the external store — resolved state comes from the
    // thread itself and scroll-to is unavailable.
    for (const thread of threads) {
      if (rows.some((row) => row.commentId === thread.id)) continue;
      rows.push({
        commentId: thread.id,
        mark: null,
        threadData: thread,
        resolved: thread.resolved,
        quoteText: thread.messages[0]?.text ?? '',
      });
    }
    return rows;
  }, [editorMarks, threads, isResolvedMark]);

  const displayThreads = useMemo(() => {
    return allRows.filter((row) => {
      if (filter === 'open') return !row.resolved;
      if (filter === 'resolved') return row.resolved;
      return true;
    });
  }, [allRows, filter]);

  if (!editor) return null;

  const hasCommentExtension = editor.extensionManager.extensions.some(
    (extension) => extension.name === 'comment',
  );
  if (!hasCommentExtension) return null;

  const resolvedCurrentUser = currentUser || ui.messages.commentPanel.you;
  // Counts share the displayThreads denominator (doc marks joined with thread
  // data, plus orphan threads) so badges match the filtered lists.
  const openCount = allRows.filter((row) => !row.resolved).length;
  const resolvedCount = allRows.filter((row) => row.resolved).length;

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
          {ui.messages.commentPanel.all} ({allRows.length})
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
          {allRows.length === 0
            ? ui.messages.commentPanel.emptyNoComments
            : ui.messages.commentPanel.emptyNoMatch}
        </div>
      ) : (
        <div className="inkio-comment-list">
          {displayThreads.map(({ commentId, mark, threadData, resolved: isResolved, quoteText }) => {
            const isActive = activeThread === commentId;

            return (
              <div
                key={commentId}
                ref={(el) => {
                  if (el) threadRefs.current.set(commentId, el);
                  else threadRefs.current.delete(commentId);
                }}
                className={`inkio-comment-thread ${isResolved ? 'is-resolved' : ''} ${isActive ? 'is-active' : ''}`}
              >
                <div
                  className="inkio-comment-thread-quote"
                  onClick={() => mark && handleScrollTo(mark)}
                  title={mark ? ui.messages.commentPanel.quoteHint : undefined}
                >
                  <div className="inkio-comment-quote-bar" />
                  <span className="inkio-comment-quote-text">
                    {quoteText.length > 100 ? `${quoteText.slice(0, 100)}…` : quoteText}
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
                      value={replyTexts[commentId] || ''}
                      onChange={(event) =>
                        setReplyTexts((prev) => ({ ...prev, [commentId]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleReply(commentId);
                        }
                      }}
                      onFocus={() => setActiveThread(commentId)}
                    />
                    {(replyTexts[commentId] || '').trim() && (
                      <button
                        type="button"
                        className="inkio-comment-reply-send"
                        onClick={() => handleReply(commentId)}
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
                      onClick={() => handleResolveThread(commentId)}
                    >
                      ✓ {ui.messages.commentPanel.resolve}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inkio-comment-action-btn delete"
                    onClick={() => handleDeleteThread(commentId)}
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
