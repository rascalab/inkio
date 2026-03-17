import type { Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import {
  commentComposerPluginKey,
  defaultGenerateId,
  type CommentOptions,
} from './Comment';
import { CommentComposer } from './components/CommentComposer';
import { getCreateRoot } from '../utils/create-root';

function getSelectionRect(view: EditorView, from: number, to: number) {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const left = Math.min(start.left, end.left);
  const right = Math.max(start.right, end.right);
  const top = Math.min(start.top, end.top);
  const bottom = Math.max(start.bottom, end.bottom);

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

export interface ComposerPluginState {
  active: boolean;
  from: number;
  to: number;
}

export function createCommentComposerPlugin(
  editor: Editor,
  options: CommentOptions
): Plugin {
  let popup: HTMLDivElement | null = null;
  let root: Root | null = null;

  function deactivate() {
    const tr = editor.view.state.tr.setMeta(commentComposerPluginKey, {
      active: false,
      from: 0,
      to: 0,
    });
    editor.view.dispatch(tr);
  }

  function mountAndRender(view: EditorView, pluginState: ComposerPluginState) {
    popup = document.createElement('div');
    popup.className = 'inkio';

    const editorEl = view.dom.closest('.inkio');
    if (editorEl) {
      const theme = editorEl.getAttribute('data-theme');
      if (theme) popup.setAttribute('data-theme', theme);
    }

    document.body.appendChild(popup);

    getCreateRoot().then((createRootFn) => {
      if (!popup) return;
      root = createRootFn(popup);
      renderComposer(view, pluginState);
    });
  }

  function renderComposer(view: EditorView, pluginState: ComposerPluginState) {
    if (!root) return;

    const { from, to } = pluginState;
    const anchorResolver = () => {
      try {
        return getSelectionRect(view, from, to);
      } catch {
        return null;
      }
    };

    const generateId = options.generateId ?? defaultGenerateId;

    root.render(
      <CommentComposer
        open={true}
        anchorRect={anchorResolver()}
        anchorResolver={anchorResolver}
        locale={options.locale}
        messages={options.messages}
        icons={options.icons}
        onSubmit={(text: string) => {
          const commentId = generateId();
          const selectedText = view.state.doc.textBetween(from, to, ' ').trim();

          // Close the composer first
          deactivate();

          // Apply the comment mark
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .setComment({ commentId })
            .run();

          // Notify consumer
          options.onCommentSubmit?.(commentId, text, selectedText);
        }}
        onCancel={() => {
          deactivate();
          editor.chain().focus().run();
        }}
      />,
    );
  }

  function teardown() {
    const popupToRemove = popup;
    const rootToUnmount = root;

    popup = null;
    root = null;

    queueMicrotask(() => {
      rootToUnmount?.unmount();
      popupToRemove?.remove();
    });
  }

  return new Plugin<ComposerPluginState>({
    key: commentComposerPluginKey,

    state: {
      init: (): ComposerPluginState => ({ active: false, from: 0, to: 0 }),
      apply: (tr, prev): ComposerPluginState => {
        const meta = tr.getMeta(commentComposerPluginKey);
        if (meta) return meta as ComposerPluginState;
        if (tr.docChanged && prev.active) {
          return { ...prev, from: tr.mapping.map(prev.from), to: tr.mapping.map(prev.to) };
        }
        return prev;
      },
    },

    view: () => {
      let wasActive = false;

      return {
        update: (view) => {
          const state = commentComposerPluginKey.getState(
            view.state,
          ) as ComposerPluginState;

          if (state.active && !wasActive) {
            mountAndRender(view, state);
            wasActive = true;
          } else if (!state.active && wasActive) {
            teardown();
            wasActive = false;
          } else if (state.active && root) {
            renderComposer(view, state);
          }
        },
        destroy: () => {
          teardown();
        },
      };
    },
  });
}
