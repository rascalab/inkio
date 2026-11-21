import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { MarkType, Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { Step } from '@tiptap/pm/transform';
import type { InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  formatTimeAgo,
  useInkioCommentUi,
  type InkioCommentMessageOverrides,
} from '../i18n';
import { findCommentRanges, getInitials } from '../utils';
import {
  isKnownCommentThread,
  normalizeCommentId,
  notifyCommentThreadsChanged,
  readCommentThread,
  type CommentMessage,
  type CommentOptions,
  type CommentThreadData,
} from '../comment-shared';
import { CommentActionIcon } from './CommentActionIcon';

// ─── Data types ────────────────────────────────────────────

export type { CommentMessage, CommentThreadData };

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
  /** Valid threads for this document and user. Host mutations still require authorization. */
  threads: CommentThreadData[];
  /** Called when user submits a reply to a thread (omit to hide reply UI) */
  onReply?: (commentId: string, text: string) => void;
  /** Called to resolve a thread (omit to hide the resolve action) */
  onResolve?: (commentId: string) => void;
  /** Called to delete a thread (omit to hide the delete action) */
  onDelete?: (commentId: string) => void;
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

      const commentId = normalizeCommentId(mark.attrs.commentId);
      if (!commentId || commentId !== mark.attrs.commentId) continue;

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

/**
 * Conservative check: could this step change the comment marks (their set,
 * text, or resolved state)? Only the step's own range and inserted slice are
 * inspected — never the whole doc. Unknown step shapes return true.
 * Pure position shifts do not count: positions are re-read on demand
 * (`findEditorMark`) instead of being kept fresh on every keystroke.
 */
export function stepMayAffectComments(doc: PMNode, step: Step, markType: MarkType): boolean {
  const s = step as unknown as {
    from?: number;
    to?: number;
    pos?: number;
    mark?: { type?: unknown };
    slice?: { content?: { descendants?: (f: (node: PMNode) => boolean | void) => void } };
  };

  // Add/RemoveMarkStep (and node-mark steps): relevant only for comment marks.
  if (s.mark) return s.mark.type === markType;

  if (typeof s.from !== 'number' || typeof s.to !== 'number') {
    // AttrStep (node attrs) cannot touch marks; anything else is unknown.
    return typeof s.pos !== 'number';
  }

  const hasComment = (node: PMNode) => node.isText && !!markType.isInSet(node.marks);

  // The replaced range touches commented text (edit inside/next to a mark,
  // or a delete across one).
  let hit = false;
  doc.nodesBetween(Math.max(0, s.from - 1), Math.min(doc.content.size, s.to + 1), (node) => {
    if (hit) return false;
    if (hasComment(node)) hit = true;
    return !hit;
  });
  if (hit) return true;

  // Inserted content carries comment marks (paste, drag-move).
  s.slice?.content?.descendants?.((node) => {
    if (hit) return false;
    if (hasComment(node)) hit = true;
    return !hit;
  });
  return hit;
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
  const [editable, setEditable] = useState(() => editor?.isEditable ?? false);
  const [replyTexts, setReplyTexts] = useState(() => new Map<string, string>());
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const threadRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const threadsById = useMemo(() => {
    const byId = new Map<string, CommentThreadData>();
    if (Array.isArray(threads)) {
      for (const thread of threads) {
        if (isKnownCommentThread(thread) && !byId.has(thread.id)) byId.set(thread.id, thread);
      }
    }
    return byId;
  }, [threads]);

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


  useEffect(() => {
    setEditable(editor?.isEditable ?? false);
    if (!editor) return;

    let lastDoc = editor.state.doc;
    let lastEditable = editor.isEditable;
    setEditorMarks(collectEditorMarks(editor));

    const refresh = ({ transaction }: { transaction?: Transaction } = {}) => {
      if (editor.state.doc !== lastDoc) {
        const previousDoc = lastDoc;
        lastDoc = editor.state.doc;
        // Skip the full-doc walk when the transaction provably leaves the
        // comment marks alone (plain typing outside any comment). Only
        // applies when the transaction continues from the last seen doc.
        const markType = editor.state.schema.marks.comment;
        if (
          markType
          && transaction
          && transaction.before === previousDoc
          && transaction.doc === editor.state.doc
          && !transaction.steps.some((step, index) =>
            stepMayAffectComments(transaction.docs[index] ?? transaction.before, step, markType))
        ) {
          return;
        }
        const next = collectEditorMarks(editor);
        // Typing elsewhere shifts positions but usually leaves the mark set
        // identical — keep the previous array identity so the panel (and its
        // subtree) doesn't re-render on every keystroke.
        setEditorMarks((prev) => (isSameEditorMarks(prev, next) ? prev : next));
      }
    };

    editor.on('transaction', refresh);
    const refreshEditable = () => {
      if (editor.isEditable === lastEditable) return;
      lastEditable = editor.isEditable;
      setEditable(lastEditable);
    };
    editor.on('update', refreshEditable);
    return () => {
      editor.off('transaction', refresh);
      editor.off('update', refreshEditable);
    };
  }, [editor]);

  const handleScrollTo = useCallback(
    (commentId: string) => {
      if (!editor) return;

      // Positions in panel state may be stale (typing elsewhere does not
      // refresh them), so re-read the mark's current ranges.
      // Select only the first contiguous span; never select the gap or use a stale range.
      const [target] = findCommentRanges(editor.state.doc, commentId);
      if (!target) return;
      const size = editor.state.doc.content.size;
      if (
        !Number.isFinite(target.from) ||
        !Number.isFinite(target.to) ||
        target.from < 0 ||
        target.to > size
      ) {
        return;
      }
      editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).run();
      // Scroll is best-effort: a remapped position may have no DOM node even
      // inside range. The selection above already applied, so a missing node
      // ends the gesture instead of breaking the click handler.
      let node: unknown = null;
      try {
        node = editor.view.domAtPos(target.from).node;
      } catch {
        return;
      }
      (node as HTMLElement)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    },
    [editor],
  );

  const replyTextsRef = useRef(replyTexts);
  replyTextsRef.current = replyTexts;

  const handleReply = useCallback(
    (commentId: string) => {
      const text = replyTextsRef.current.get(commentId)?.trim();
      if (!editor?.isEditable || !text || !onReply ||
          threadsById.get(commentId)?.resolved !== false ||
          findCommentRanges(editor.state.doc, commentId).length === 0) return;

      onReply(commentId, text);
      setReplyTexts((prev) => {
        const next = new Map(prev);
        next.delete(commentId);
        return next;
      });
    },
    [editor, onReply, threadsById],
  );

  const handleDeleteThread = useCallback(
    (commentId: string) => {
      if (!editor?.isEditable || !onDelete || !threadsById.has(commentId)) return;
      const ranges = findCommentRanges(editor.state.doc, commentId);
      if (!ranges.length) return;

      const tr = editor.state.tr;
      for (const { from, to, mark } of ranges) tr.removeMark(from, to, mark);
      const before = tr.before;
      editor.view.dispatch(tr);
      if (editor.state.doc !== before) onDelete(commentId);
    },
    [editor, onDelete, threadsById],
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
      if (!editor?.isEditable || !onResolve || threadsById.get(commentId)?.resolved !== false) return;
      const commentExtension = editor.extensionManager.extensions.find(
        (extension) => extension.name === 'comment',
      );
      const options = commentExtension?.options as Partial<CommentOptions> | undefined;
      const commandWillNotify = onResolve === options?.onCommentResolve
        && readCommentThread(options?.getThread, commentId) !== null;
      if (editor.commands.resolveComment?.(commentId) && !commandWillNotify) onResolve(commentId);
    },
    [editor, onResolve, threadsById],
  );

  interface PanelRow {
    commentId: string;
    threadData: CommentThreadData | undefined;
    resolved: boolean;
    quoteText: string;
  }

  // The document decides what is listed: a thread whose text was deleted leaves
  // the panel, and undo brings it back along with its mark.
  const allRows = useMemo<PanelRow[]>(() => {
    return editorMarks.map((mark) => {
      const threadData = threadsById.get(mark.commentId);
      return {
        commentId: mark.commentId,
        threadData,
        resolved: threadData?.resolved ?? mark.resolved,
        quoteText: mark.text,
      };
    });
  }, [editorMarks, threadsById]);

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

  const resolvedCurrentUser = typeof currentUser === 'string' && currentUser
    ? currentUser
    : ui.messages.commentPanel.you;
  // Counts share the displayThreads denominator so badges match the filtered lists.
  const openCount = allRows.filter((row) => !row.resolved).length;
  const resolvedCount = allRows.length - openCount;

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
          {displayThreads.map(({ commentId, threadData, resolved: isResolved, quoteText }) => {
            const isActive = activeThread === commentId;
            const canMutate = editable && Boolean(threadData);
            const replyText = replyTexts.get(commentId) ?? '';

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
                  onClick={() => handleScrollTo(commentId)}
                  title={ui.messages.commentPanel.quoteHint}
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
                            <span className="inkio-comment-msg-time">{formatTimeAgo(ui.messages.commentPanel.time, msg.createdAt)}</span>
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

                {canMutate && onReply && !isResolved && (
                  <div className="inkio-comment-reply-row">
                    <input
                      type="text"
                      className="inkio-comment-reply-input"
                      placeholder={ui.messages.commentPanel.replyPlaceholder}
                      value={replyText}
                      onChange={(event) => {
                        const value = event.target.value;
                        setReplyTexts((prev) => new Map(prev).set(commentId, value));
                      }}
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleReply(commentId);
                        }
                      }}
                      onFocus={() => setActiveThread(commentId)}
                    />
                    {replyText.trim() && (
                      <button
                        type="button"
                        className="inkio-comment-reply-send"
                        onClick={() => handleReply(commentId)}
                      >
                        <CommentActionIcon icon={ui.icons.reply} />↵
                      </button>
                    )}
                  </div>
                )}

                {canMutate && (onResolve || onDelete) && (
                  <div className="inkio-comment-thread-actions">
                    {onResolve && !isResolved && (
                      <button
                        type="button"
                        className="inkio-comment-action-btn resolve"
                        onClick={() => handleResolveThread(commentId)}
                      >
                        <CommentActionIcon icon={ui.icons.resolve} />✓ {ui.messages.commentPanel.resolve}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="inkio-comment-action-btn delete"
                        onClick={() => handleDeleteThread(commentId)}
                      >
                        <CommentActionIcon icon={ui.icons.delete} />✕ {ui.messages.commentPanel.delete}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
