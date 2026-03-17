import type { Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import {
  commentThreadPopoverPluginKey,
  type CommentOptions,
} from './Comment';
import { CommentThreadPopover } from './components/CommentThreadPopover';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
} from '@inkio/core';
import { getCreateRoot } from '../utils/create-root';

interface ThreadPopoverPluginState {
  active: boolean;
  threadId: string;
}

/** Collect the text content for all spans of a given comment mark. */
function collectMarkText(editor: Editor, threadId: string): string {
  const ranges = findMarkRanges(editor, threadId);
  if (ranges.length === 0) return '';
  return ranges.map(({ from, to }) => editor.state.doc.textBetween(from, to, ' ')).join(' ');
}

/** Find all ranges in the document that carry a specific comment mark. */
function findMarkRanges(
  editor: Editor,
  threadId: string,
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
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

export function createCommentThreadPopoverPlugin(
  editor: Editor,
  options: CommentOptions,
): Plugin {
  let popup: HTMLDivElement | null = null;
  let root: Root | null = null;
  let cleanupAutoUpdate: (() => void) | null = null;
  let currentThreadId = '';

  function deactivate() {
    const tr = editor.view.state.tr.setMeta(commentThreadPopoverPluginKey, {
      active: false,
      threadId: '',
    });
    editor.view.dispatch(tr);
  }

  function updatePosition() {
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

  function mountAndRender(threadId: string) {
    currentThreadId = threadId;

    popup = document.createElement('div');
    popup.className = 'inkio';
    popup.style.position = 'fixed';
    popup.style.zIndex = 'var(--inkio-layer-popover, 150)';

    const editorEl = editor.view.dom.closest('.inkio');
    if (editorEl) {
      const theme = editorEl.getAttribute('data-theme');
      if (theme) popup.setAttribute('data-theme', theme);
    }

    document.body.appendChild(popup);

    cleanupAutoUpdate = autoUpdateOverlayPosition({
      update: updatePosition,
      elements: [editor.view.dom, popup],
    });

    getCreateRoot().then((createRootFn) => {
      if (!popup) return;
      root = createRootFn(popup);
      renderPopover();
    });
  }

  function renderPopover() {
    if (!root || !currentThreadId) return;

    const thread = options.getThread?.(currentThreadId) ?? null;
    const quotedText = collectMarkText(editor, currentThreadId);
    const currentUser = options.currentUser ?? 'User';

    root.render(
      <CommentThreadPopover
        threadId={currentThreadId}
        quotedText={quotedText}
        thread={thread}
        currentUser={currentUser}
        locale={options.locale}
        messages={options.messages}
        icons={options.icons}
        onReply={(id: string, text: string) => {
          options.onCommentReply?.(id, text);
        }}
        onResolve={(id: string) => {
          (
            editor.commands as unknown as {
              resolveComment?: (commentId: string) => boolean;
            }
          ).resolveComment?.(id);
          options.onCommentResolve?.(id);
          deactivate();
        }}
        onDelete={(id: string) => {
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
        }}
        onClose={() => {
          deactivate();
        }}
      />,
    );

    requestAnimationFrame(updatePosition);
  }

  function teardown() {
    const popupToRemove = popup;
    const rootToUnmount = root;

    cleanupAutoUpdate?.();
    cleanupAutoUpdate = null;
    popup = null;
    root = null;
    currentThreadId = '';

    queueMicrotask(() => {
      rootToUnmount?.unmount();
      popupToRemove?.remove();
    });
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

      return {
        update: (view) => {
          const state = commentThreadPopoverPluginKey.getState(
            view.state,
          ) as ThreadPopoverPluginState;

          if (state.active && (!wasActive || state.threadId !== lastThreadId)) {
            // Opening a new thread (or switching threads)
            if (wasActive) teardown();
            mountAndRender(state.threadId);
            wasActive = true;
            lastThreadId = state.threadId;
          } else if (!state.active && wasActive) {
            teardown();
            wasActive = false;
            lastThreadId = '';
          } else if (state.active && root) {
            // Re-render to pick up updated thread data (new replies, etc.)
            renderPopover();
          }
        },
        destroy: () => {
          teardown();
        },
      };
    },
  });
}
