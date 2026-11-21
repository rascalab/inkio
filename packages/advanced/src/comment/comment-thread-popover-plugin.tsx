import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import {
  commentThreadPopoverPluginKey,
  COMMENT_THREADS_CHANGED_EVENT,
  normalizeCommentId,
  readCommentThread,
  type CommentThreadData,
  type CommentOptions,
} from './comment-shared';
import { CommentThreadPopover } from './components/CommentThreadPopover';
import { findCommentRanges, type CommentRange } from './utils';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  createOverlayHost,
  editorUi,
  type OverlayHost,
} from '@inkio/core';

interface ThreadPopoverPluginState {
  active: boolean;
  threadId: string;
}

type MarkRange = { from: number; to: number };

/** Collect the text content for all spans of the given mark ranges. */
function collectRangesText(doc: ProseMirrorNode, ranges: MarkRange[]): string {
  if (ranges.length === 0) return '';
  return ranges.map(({ from, to }) => doc.textBetween(from, to, ' ')).join(' ');
}

/**
 * Compare two documents and report whether the changed region touches any of
 * `ranges` (positions in `prev`). When the change lies entirely before the
 * ranges, they are shifted in place so they stay valid for `next`.
 * Returns true when the ranges must be recomputed.
 *
 * @internal Exported for unit tests only (not re-exported from the package).
 */
export function diffTouchesRanges(
  prev: ProseMirrorNode,
  next: ProseMirrorNode,
  ranges: MarkRange[],
): boolean {
  if (ranges.length === 0) return true;

  const start = prev.content.findDiffStart(next.content);
  if (start === null) return false;

  const end = prev.content.findDiffEnd(next.content);
  if (!end) return true;
  let endA = end.a;
  let endB = end.b;
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }

  const first = ranges[0].from;
  const last = ranges[ranges.length - 1].to;
  // Inclusive bounds: an edit adjacent to the mark can extend/split it.
  if (start <= last && endA >= first) return true;

  if (endA < first) {
    const delta = endB - endA;
    if (delta !== 0) {
      for (const range of ranges) {
        range.from += delta;
        range.to += delta;
      }
    }
  }
  return false;
}

/** Threads are small (a handful of messages); JSON is a cheap content key. */
function snapshotThread(thread: unknown): string {
  try {
    return JSON.stringify(thread) ?? '';
  } catch {
    return '';
  }
}

export function createCommentThreadPopoverPlugin(
  editor: Editor,
  options: CommentOptions,
): Plugin {
  let host: OverlayHost | null = null;
  let cleanupAutoUpdate: (() => void) | null = null;
  let currentThreadId = '';
  let cachedRanges: CommentRange[] = [];
  let cachedQuotedText = '';
  // Content snapshot of the rendered thread: compared instead of identity so
  // both fresh objects per call and in-place mutation are handled.
  let renderedSnapshot = '';
  const getThread = () => cachedRanges.length ? readCommentThread(options.getThread, currentThreadId) : null;
  let positionRaf = 0;

  function deactivate() {
    const tr = editor.view.state.tr.setMeta(commentThreadPopoverPluginKey, {
      active: false,
      threadId: '',
    });
    editor.view.dispatch(tr);
  }

  function refreshQuotedText() {
    cachedRanges = findCommentRanges(editor.state.doc, currentThreadId);
    cachedQuotedText = collectRangesText(editor.state.doc, cachedRanges);
  }

  function updatePosition() {
    const popup = host?.element;
    if (!popup || !currentThreadId) return;

    const markEl = editor.view.dom.querySelector(
      `span[data-comment-id="${CSS.escape(currentThreadId)}"]`,
    );
    if (!markEl) return;

    const rect = markEl.getBoundingClientRect();
    const next = computeOverlayPosition({
      anchorRect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      floatingRect: {
        width: popup.offsetWidth || 340,
        height: popup.offsetHeight || 200,
      },
      placement: 'bottom',
      align: 'start',
      offset: 8,
      padding: 8,
      flip: true,
      shift: true,
    });

    popup.style.left = `${next.left}px`;
    popup.style.top = `${next.top}px`;
  }

  function schedulePosition() {
    if (positionRaf) return;
    positionRaf = requestAnimationFrame(() => {
      positionRaf = 0;
      updatePosition();
    });
  }

  // Recheck even when the currently rendered controls are stale.
  const canChangeThread = (id: string) =>
    editor.isEditable && id === currentThreadId && cachedRanges.length > 0;
  const handleReply = (id: string, text: string) => {
    if (canChangeThread(id) && getThread()?.resolved === false) options.onCommentReply?.(id, text);
  };
  const handleResolve = (id: string) => {
    if (!canChangeThread(id) || getThread()?.resolved !== false) return;
    editor.commands.resolveComment(id);
    deactivate();
  };
  const handleDelete = (id: string) => {
    if (!canChangeThread(id) || !options.onCommentDelete || !getThread()) return;
    const tr = editor.view.state.tr;
    for (const { from, to, mark } of cachedRanges) tr.removeMark(from, to, mark);
    tr.setMeta(commentThreadPopoverPluginKey, { active: false, threadId: '' });
    const before = tr.before;
    editor.view.dispatch(tr);
    if (editor.state.doc !== before) options.onCommentDelete(id);
  };
  const handleClose = () => {
    deactivate();
  };

  function mountAndRender(threadId: string) {
    currentThreadId = threadId;
    refreshQuotedText();

    host = createOverlayHost({
      editorDom: editor.view.dom,
      label: 'comment popover',
      style: {
        position: 'fixed',
        zIndex: 'var(--inkio-layer-popover, 150)',
      },
    });

    cleanupAutoUpdate = autoUpdateOverlayPosition({
      update: updatePosition,
      elements: [editor.view.dom, host.element],
    });

    renderPopover();
  }

  function renderPopover(thread: CommentThreadData | null = getThread()) {
    if (!host || !currentThreadId) return;
    renderedSnapshot = snapshotThread(thread);
    const currentUser = typeof options.currentUser === 'string' ? options.currentUser : 'User';

    // Read-only surfaces render threads but offer no actions: omitting a
    // callback hides its UI, so frozen discussion views fall out naturally.
    const canMutate = editor.isEditable && thread !== null && cachedRanges.length > 0;
    host.render(
      <CommentThreadPopover
        threadId={currentThreadId}
        quotedText={cachedQuotedText}
        thread={thread}
        currentUser={currentUser}
        {...editorUi(editor, options)}
        onReply={canMutate && options.onCommentReply ? handleReply : undefined}
        onResolve={canMutate && options.onCommentResolve ? handleResolve : undefined}
        onDelete={canMutate && options.onCommentDelete ? handleDelete : undefined}
        onClose={handleClose}
      />,
    );

    schedulePosition();
  }

  function teardown() {
    if (positionRaf) {
      cancelAnimationFrame(positionRaf);
      positionRaf = 0;
    }
    cleanupAutoUpdate?.();
    cleanupAutoUpdate = null;
    host?.destroy();
    host = null;
    currentThreadId = '';
    cachedRanges = [];
    cachedQuotedText = '';
    renderedSnapshot = '';
  }

  return new Plugin<ThreadPopoverPluginState>({
    key: commentThreadPopoverPluginKey,

    state: {
      init: (): ThreadPopoverPluginState => ({ active: false, threadId: '' }),
      apply: (tr, prev): ThreadPopoverPluginState => {
        const meta = tr.getMeta(commentThreadPopoverPluginKey);
        if (meta) return meta as ThreadPopoverPluginState;
        return prev;
      },
    },

    props: {
      handleClick: (view, _pos, event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return false;

        const commentEl = target.closest('span[data-comment-id]');
        if (!commentEl || !view.dom.contains(commentEl)) return false;

        const threadId = normalizeCommentId(commentEl.getAttribute('data-comment-id'));
        if (!threadId) return false;

        // Toggle: clicking the same thread again closes the popover
        const currentState = commentThreadPopoverPluginKey.getState(
          editor.view.state,
        ) as ThreadPopoverPluginState;

        if (currentState.active && currentState.threadId === threadId) {
          deactivate();
          return false;
        }

        // Activate the popover for this thread
        const tr = editor.view.state.tr.setMeta(commentThreadPopoverPluginKey, {
          active: true,
          threadId,
        });
        editor.view.dispatch(tr);

        return false;
      },
    },

    view: () => {
      let wasActive = false;
      let lastThreadId = '';
      let lastEditable = editor.isEditable;

      // External thread data (the CommentPanel `threads` prop) can change
      // without any document transaction — e.g. a reply arrives while the
      // popover is open. Re-read getThread on notification so the popover
      // never shows stale messages.
      const handleThreadsChanged = () => {
        if (!wasActive || !host || !currentThreadId) return;
        const thread = getThread();
        if (snapshotThread(thread) !== renderedSnapshot) renderPopover(thread);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener(COMMENT_THREADS_CHANGED_EVENT, handleThreadsChanged);
      }

      return {
        update: (view, prevState) => {
          const state = commentThreadPopoverPluginKey.getState(
            view.state,
          ) as ThreadPopoverPluginState;

          if (state.active && (!wasActive || state.threadId !== lastThreadId)) {
            // Opening a new thread (or switching threads)
            if (wasActive) teardown();
            lastEditable = editor.isEditable;
            mountAndRender(state.threadId);
            wasActive = true;
            lastThreadId = state.threadId;
          } else if (!state.active && wasActive) {
            teardown();
            wasActive = false;
            lastThreadId = '';
          } else if (state.active && host) {
            // Also pick up host stores that mutate thread objects in place without
            // emitting a notification, including selection-only transactions.
            let needsRender = false;
            if (view.state.doc !== prevState.doc) {
              if (diffTouchesRanges(prevState.doc, view.state.doc, cachedRanges)) {
                const previousText = cachedQuotedText;
                const hadRanges = cachedRanges.length > 0;
                refreshQuotedText();
                needsRender = cachedQuotedText !== previousText || hadRanges !== (cachedRanges.length > 0);
              }
              // The mark may have moved on screen even when untouched.
              schedulePosition();
            }
            const thread = getThread();
            needsRender ||= snapshotThread(thread) !== renderedSnapshot;
            if (editor.isEditable !== lastEditable) {
              lastEditable = editor.isEditable;
              needsRender = true;
            }
            if (needsRender) renderPopover(thread);
          }
        },
        destroy: () => {
          if (typeof window !== 'undefined') {
            window.removeEventListener(COMMENT_THREADS_CHANGED_EVENT, handleThreadsChanged);
          }
          teardown();
        },
      };
    },
  });
}
