import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { useState, useCallback, useEffect } from 'react';
import { createOverlayHost, type OverlayHost } from '../utils/overlay-host';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  toRectLike,
} from '../overlay/positioning';

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

export function CalloutToolbar({ editor, currentColor, currentIcon }: CalloutToolbarProps) {
  const [iconValue, setIconValue] = useState(currentIcon || '');
  // The toolbar instance outlives the selected callout: follow prop changes
  // or the input keeps showing the previous block's icon.
  useEffect(() => {
    setIconValue(currentIcon || '');
  }, [currentIcon]);

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
    <div
      className="inkio-callout-toolbar"
      onMouseDown={(e) => {
        // Keep editor selection when pressing buttons, but let text inputs
        // (icon field) take focus normally on click.
        if ((e.target as HTMLElement | null)?.tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
    >
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

/** Vertical slot (toolbar height + gap) reserved above the callout. */
const TOOLBAR_SLOT = 44;
/** Toolbar height assumed before the first React render measures it. */
const TOOLBAR_FALLBACK_HEIGHT = 36;

export function createCalloutToolbarPlugin(editor: Editor): Plugin {
  let host: OverlayHost | null = null;
  let cleanupAutoUpdate: (() => void) | null = null;
  let positionRaf = 0;
  let positionTarget: { view: EditorView; pos: number } | null = null;
  let renderedAttrs: { color: string | null; icon: string | null } | null = null;

  function cancelScheduledPosition() {
    if (positionRaf) {
      cancelAnimationFrame(positionRaf);
      positionRaf = 0;
    }
  }

  function teardown() {
    cancelScheduledPosition();
    cleanupAutoUpdate?.();
    cleanupAutoUpdate = null;
    host?.destroy();
    host = null;
    positionTarget = null;
    renderedAttrs = null;
  }

  function renderToolbar(calloutColor: string | null, calloutIcon: string | null) {
    if (!host) return;
    if (
      renderedAttrs
      && renderedAttrs.color === calloutColor
      && renderedAttrs.icon === calloutIcon
    ) {
      return;
    }
    renderedAttrs = { color: calloutColor, icon: calloutIcon };

    host.render(
      <CalloutToolbar
        editor={editor}
        currentColor={calloutColor}
        currentIcon={calloutIcon}
      />,
    );
  }

  function positionContainer() {
    const container = host?.element;
    if (!container || !positionTarget) return;
    const { view, pos } = positionTarget;

    const calloutDom = view.nodeDOM(pos);
    if (!(calloutDom instanceof HTMLElement)) return;

    const rect = calloutDom.getBoundingClientRect();
    const editorRect = view.dom.getBoundingClientRect();
    const height = container.offsetHeight || TOOLBAR_FALLBACK_HEIGHT;

    // Default (non-overflow) placement: the callout's left edge, TOOLBAR_SLOT
    // px above its top. Flips below / shifts into the viewport on overflow.
    const next = computeOverlayPosition({
      anchorRect: toRectLike(rect),
      floatingRect: { width: container.offsetWidth, height },
      placement: 'top',
      align: 'start',
      offset: Math.max(0, TOOLBAR_SLOT - height),
      padding: 8,
      flip: true,
      shift: true,
    });

    // The container is absolutely positioned inside the editor wrapper;
    // convert viewport coordinates to editor-relative ones.
    container.style.top = `${next.top - editorRect.top}px`;
    container.style.left = `${next.left - editorRect.left}px`;
  }

  function schedulePosition() {
    if (positionRaf) return;
    positionRaf = requestAnimationFrame(() => {
      positionRaf = 0;
      positionContainer();
    });
  }

  function mountAndRender(
    view: EditorView,
    calloutPos: number,
    calloutColor: string | null,
    calloutIcon: string | null,
  ) {
    // Append to the editor wrapper so it inherits tokens and is positioned relative
    const positionParent = view.dom.parentElement;
    if (positionParent) {
      // Ensure position context exists
      const computedStyle = getComputedStyle(positionParent);
      if (computedStyle.position === 'static') {
        positionParent.style.position = 'relative';
      }
    }

    host = createOverlayHost({
      editorDom: view.dom,
      className: 'inkio-callout-toolbar-wrapper',
      label: 'callout toolbar',
      parent: positionParent,
      style: {
        position: 'absolute',
        zIndex: 'var(--inkio-layer-popover, 150)',
      },
    });

    positionTarget = { view, pos: calloutPos };
    positionContainer();
    renderToolbar(calloutColor, calloutIcon);

    // Track scroll/resize and the real toolbar size once rendered
    // (rAF-coalesced by the overlay engine).
    cleanupAutoUpdate = autoUpdateOverlayPosition({
      update: positionContainer,
      elements: [view.dom, host.element],
    });
  }

  return new Plugin({
    key: calloutToolbarPluginKey,
    view() {
      let wasVisible = false;
      let lastCalloutPos = -1;

      return {
        update(view, prevState) {
          // Read-only surfaces (Viewer) never show the editing toolbar.
          if (!view.editable) {
            if (wasVisible) {
              teardown();
              wasVisible = false;
              lastCalloutPos = -1;
            }
            return;
          }
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
            // Re-render only when attrs changed; re-measure (once per frame)
            // only when the callout moved or the document changed.
            renderToolbar(color, icon);
            if (pos !== lastCalloutPos || view.state.doc !== prevState.doc) {
              lastCalloutPos = pos;
              positionTarget = { view, pos };
              schedulePosition();
            }
          }
        },
        destroy() {
          teardown();
        },
      };
    },
  });
}
