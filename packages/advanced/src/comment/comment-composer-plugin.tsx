import type { Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import {
  commentComposerPluginKey,
  defaultGenerateId,
  type CommentOptions,
} from './Comment';
import { CommentComposer } from './components/CommentComposer';
import { createOverlayHost, type OverlayHost } from '@inkio/core';

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
  let host: OverlayHost | null = null;

  function deactivate() {
    const tr = editor.view.state.tr.setMeta(commentComposerPluginKey, {
      active: false,
      from: 0,
      to: 0,
    });
    editor.view.dispatch(tr);
  }

  function mountAndRender(view: EditorView, pluginState: ComposerPluginState) {
    host = createOverlayHost({ editorDom: view.dom, label: 'comment composer' });
    renderComposer(view, pluginState);
  }

  function renderComposer(view: EditorView, pluginState: ComposerPluginState) {
    if (!host) return;

    const { from, to } = pluginState;
    const anchorResolver = () => {
      try {
        return getSelectionRect(view, from, to);
      } catch {
        return null;
      }
    };

    const generateId = options.generateId ?? defaultGenerateId;

    host.render(
      <CommentComposer
        open={true}
        anchorRect={anchorResolver()}
        anchorResolver={anchorResolver}
        locale={options.locale}
        messages={options.messages}
        icons={options.icons}
        onSubmit={(text: string) => {
          // The composer must never mutate a read-only editor.
          if (!editor.isEditable) {
            deactivate();
            return;
          }
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
    host?.destroy();
    host = null;
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
      let lastRenderedRange: { from: number; to: number } | null = null;
      let positionRaf: number | null = null;

      const cancelScheduledRender = () => {
        if (positionRaf !== null) {
          cancelAnimationFrame(positionRaf);
          positionRaf = null;
        }
      };

      return {
        update: (view) => {
          const state = commentComposerPluginKey.getState(
            view.state,
          ) as ComposerPluginState;

          if (state.active && !wasActive) {
            cancelScheduledRender();
            mountAndRender(view, state);
            lastRenderedRange = { from: state.from, to: state.to };
            wasActive = true;
          } else if (!state.active && wasActive) {
            cancelScheduledRender();
            teardown();
            lastRenderedRange = null;
            wasActive = false;
          } else if (state.active && host) {
            // While composing, every keystroke/scroll/resize fires view.update.
            // A full root re-render plus coordsAtPos (forced layout) per update
            // is wasted when the commented range did not move — scroll/resize
            // repositioning is already owned by CommentComposer's overlay
            // engine. Re-render (rAF-coalesced) only on range change.
            if (
              lastRenderedRange
              && lastRenderedRange.from === state.from
              && lastRenderedRange.to === state.to
            ) {
              return;
            }
            lastRenderedRange = { from: state.from, to: state.to };
            if (positionRaf !== null) return;
            const snapshot = { ...state };
            positionRaf = requestAnimationFrame(() => {
              positionRaf = null;
              renderComposer(view, snapshot);
            });
          }
        },
        destroy: () => {
          cancelScheduledRender();
          teardown();
        },
      };
    },
  });
}
