import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import {
  commentThreadPopoverPluginKey,
  COMMENT_THREADS_CHANGED_EVENT,
  type CommentOptions,
} from './Comment';
import { CommentThreadPopover } from './components/CommentThreadPopover';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  createOverlayHost,
  type OverlayHost,
} from '@inkio/core';

interface ThreadPopoverPluginState {
  active: boolean;
  threadId: string;
}

type MarkRange = { from: number; to: number };

/** Find all ranges in the document that carry a specific comment mark. */
function findMarkRanges(editor: Editor, threadId: string): MarkRange[] {
  const ranges: MarkRange[] = [];
  const markType = editor.state.schema.marks.comment;
  if (!markType) return ranges;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;

    const mark = node.marks.find(
      (m) => m.type === markType && m.attrs.commentId === threadId,
    );

    if (mark) {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  return ranges;
}

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
 */
function diffTouchesRanges(
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

export function createCommentThreadPopoverPlugin(
  editor: Editor,
  options: CommentOptions,
): Plugin {
  let host: OverlayHost | null = null;
  let cleanupAutoUpdate: (() => void) | null = null;
  let currentThreadId = '';
  let cachedRanges: MarkRange[] = [];
  let cachedQuotedText = '';
  let renderedThread: unknown = undefined;
  let positionRaf = 0;

  function deactivate() {
    const tr = editor.view.state.tr.setMeta(commentThreadPopoverPluginKey, {
      active: false,
      threadId: '',
    });
    editor.view.dispatch(tr);
  }

  function refreshQuotedText() {
    cachedRanges = findMarkRanges(editor, currentThreadId);
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

  // Stable callbacks: re-renders don't hand React fresh closures each time.
  // canMutate is captured at render time: each action re-checks at action
  // time in case the editor flipped read-only while open.
  const handleReply = (id: string, text: string) => {
    if (!editor.isEditable) return;
    options.onCommentReply?.(id, text);
  };
  const handleResolve = (id: string) => {
    if (!editor.isEditable) return;
    // resolveComment() already invokes onCommentResolve internally.
    (
      editor.commands as unknown as {
        resolveComment?: (commentId: string) => boolean;
      }
    ).resolveComment?.(id);
    deactivate();
  };
  const handleDelete = (id: string) => {
    if (!editor.isEditable) return;
    // Remove comment marks from the document
    const markType = editor.state.schema.marks.comment;
    if (markType) {
      const ranges = findMarkRanges(editor, id);
      if (ranges.length > 0) {
        const tr = editor.view.state.tr;
        ranges.forEach(({ from, to }) => tr.removeMark(from, to, markType));
        editor.view.dispatch(tr);
      }
    }

    options.onCommentDelete?.(id);
    deactivate();
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

  function renderPopover() {
    if (!host || !currentThreadId) return;

    const thread = options.getThread?.(currentThreadId) ?? null;
    renderedThread = thread;
    const currentUser = options.currentUser ?? 'User';

    // Read-only surfaces render threads but offer no actions: omitting a
    // callback hides its UI, so frozen discussion views fall out naturally.
    const canMutate = editor.isEditable;
    host.render(
      <CommentThreadPopover
        threadId={currentThreadId}
        quotedText={cachedQuotedText}
        thread={thread}
        currentUser={currentUser}
        locale={options.locale}
        messages={options.messages}
        icons={options.icons}
        onReply={canMutate && options.onCommentReply ? handleReply : undefined}
        onResolve={canMutate ? handleResolve : undefined}
        onDelete={canMutate ? handleDelete : undefined}
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
    renderedThread = undefined;
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
      handleClick: (_view, _pos, event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return false;

        const commentEl = target.closest('span[data-comment-id]');
        if (!commentEl) return false;

        const threadId = commentEl.getAttribute('data-comment-id');
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
        if (wasActive && host && currentThreadId) {
          renderPopover();
        }
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
            // Avoid per-transaction work while open: only a doc change that
            // touches this thread's marks re-collects the quote, and only
            // quote/thread/editability changes re-render. Thread data changes
            // also arrive through COMMENT_THREADS_CHANGED_EVENT.
            let needsRender =
              (options.getThread?.(currentThreadId) ?? null) !== renderedThread;
            if (view.state.doc !== prevState.doc) {
              if (diffTouchesRanges(prevState.doc, view.state.doc, cachedRanges)) {
                const previousText = cachedQuotedText;
                refreshQuotedText();
                needsRender = cachedQuotedText !== previousText;
              }
              // The mark may have moved on screen even when untouched.
              schedulePosition();
            }
            if (editor.isEditable !== lastEditable) {
              lastEditable = editor.isEditable;
              needsRender = true;
            }
            if (needsRender) renderPopover();
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
