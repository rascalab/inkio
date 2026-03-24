import type { Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { useState, useCallback } from 'react';
import { getCreateRoot } from '../utils/create-root';

export const calloutToolbarPluginKey = new PluginKey('calloutToolbar');

const COLORS = [
  { name: 'blue', label: 'Blue' },
  { name: 'yellow', label: 'Yellow' },
  { name: 'red', label: 'Red' },
  { name: 'green', label: 'Green' },
  { name: 'purple', label: 'Purple' },
  { name: 'gray', label: 'Gray' },
] as const;

interface CalloutToolbarProps {
  editor: Editor;
  currentColor: string | null;
  currentIcon: string | null;
}

function CalloutToolbar({ editor, currentColor, currentIcon }: CalloutToolbarProps) {
  const [iconValue, setIconValue] = useState(currentIcon || '');

  const setColor = useCallback(
    (color: string | null) => {
      if (color) {
        editor.commands.updateCalloutColor(color);
      } else {
        editor.commands.updateAttributes('callout', { color: null });
      }
    },
    [editor],
  );

  const setIcon = useCallback(
    (icon: string) => {
      editor.commands.updateCalloutIcon(icon);
    },
    [editor],
  );

  return (
    <div className="inkio-callout-toolbar" onMouseDown={(e) => e.preventDefault()}>
      <div className="inkio-callout-toolbar-colors">
        <button
          type="button"
          className={`inkio-callout-color-btn ${!currentColor ? 'is-active' : ''}`}
          onClick={() => setColor(null)}
          aria-label="Default"
          title="Default"
        >
          <span
            className="inkio-callout-color-swatch"
            style={{
              background: 'transparent',
              border: '2px dashed var(--inkio-border, #d1d5db)',
            }}
          />
        </button>
        {COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            className={`inkio-callout-color-btn ${currentColor === c.name ? 'is-active' : ''}`}
            onClick={() => setColor(c.name)}
            aria-label={c.label}
            title={c.label}
          >
            <span
              className="inkio-callout-color-swatch"
              style={{ background: `var(--inkio-callout-${c.name})` }}
            />
          </button>
        ))}
      </div>
      <div className="inkio-callout-toolbar-icon">
        <input
          type="text"
          className="inkio-callout-icon-input"
          value={iconValue}
          placeholder="Icon"
          maxLength={2}
          onChange={(e) => {
            setIconValue(e.target.value);
            setIcon(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

function getCalloutNode(view: EditorView) {
  const { state } = view;
  const { $from } = state.selection;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'callout') {
      return { node, pos: $from.before(d), depth: d };
    }
  }
  return null;
}

export function createCalloutToolbarPlugin(editor: Editor): Plugin {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  function teardown() {
    const containerToRemove = container;
    const rootToUnmount = root;

    container = null;
    root = null;

    queueMicrotask(() => {
      rootToUnmount?.unmount();
      containerToRemove?.remove();
    });
  }

  function renderToolbar(
    calloutColor: string | null,
    calloutIcon: string | null,
  ) {
    if (!root || !container) return;

    root.render(
      <CalloutToolbar
        editor={editor}
        currentColor={calloutColor}
        currentIcon={calloutIcon}
      />,
    );
  }

  function positionContainer(view: EditorView, calloutPos: number) {
    if (!container) return;

    const calloutDom = view.nodeDOM(calloutPos);
    if (calloutDom && calloutDom instanceof HTMLElement) {
      const rect = calloutDom.getBoundingClientRect();
      const editorRect = view.dom.getBoundingClientRect();

      container.style.display = '';
      container.style.position = 'absolute';
      container.style.top = `${rect.top - editorRect.top - 44}px`;
      container.style.left = `${rect.left - editorRect.left}px`;
      container.style.zIndex = 'var(--inkio-layer-popover, 150)';
    }
  }

  function mountAndRender(
    view: EditorView,
    calloutPos: number,
    calloutColor: string | null,
    calloutIcon: string | null,
  ) {
    container = document.createElement('div');
    container.className = 'inkio-callout-toolbar-wrapper';

    const editorEl = view.dom.closest('.inkio');
    if (editorEl) {
      const isDark = editorEl.classList.contains('dark');
      container.classList.toggle('dark', isDark);
    }

    // Append to the editor wrapper so it inherits tokens and is positioned relative
    const positionParent = view.dom.parentElement;
    if (positionParent) {
      // Ensure position context exists
      const computedStyle = getComputedStyle(positionParent);
      if (computedStyle.position === 'static') {
        positionParent.style.position = 'relative';
      }
      positionParent.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    positionContainer(view, calloutPos);

    getCreateRoot().then((createRootFn) => {
      if (!container) return;
      root = createRootFn(container);
      renderToolbar(calloutColor, calloutIcon);
    });
  }

  return new Plugin({
    key: calloutToolbarPluginKey,
    view() {
      let wasVisible = false;
      let lastCalloutPos = -1;

      return {
        update(view) {
          const callout = getCalloutNode(view);

          if (!callout) {
            if (wasVisible) {
              teardown();
              wasVisible = false;
              lastCalloutPos = -1;
            }
            return;
          }

          const { node, pos } = callout;
          const color = node.attrs.color ?? null;
          const icon = node.attrs.icon ?? null;

          if (!wasVisible) {
            mountAndRender(view, pos, color, icon);
            wasVisible = true;
            lastCalloutPos = pos;
          } else {
            // Re-position if callout moved or re-render if attrs changed
            if (pos !== lastCalloutPos) {
              positionContainer(view, pos);
              lastCalloutPos = pos;
            }
            renderToolbar(color, icon);
            positionContainer(view, pos);
          }
        },
        destroy() {
          teardown();
        },
      };
    },
  });
}
