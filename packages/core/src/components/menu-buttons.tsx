import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import type { ResolvedInkioCoreUi } from '../context/use-inkio-ui';
import type { InkioToolbarAction } from './toolbar-actions';

/**
 * Shared rendering helpers for the toolbar-action menus (Toolbar, BubbleMenu,
 * FloatingMenu). Each menu keeps its own layout; these cover the logic that
 * was copied between them.
 */

/** Explicit label → localized builtin label → action id. */
export function resolveActionLabel(
  action: InkioToolbarAction,
  messages: ResolvedInkioCoreUi['messages'],
): string {
  return action.label ?? (action.labelKey ? messages.actions[action.labelKey] : action.id);
}

/** The action's registered icon, or the label's initial when none is registered. */
export function renderActionIcon(
  action: InkioToolbarAction,
  icons: ResolvedInkioCoreUi['icons'],
  label: string,
): ReactNode {
  const Icon = icons[action.iconId];
  return Icon
    ? <Icon size={16} strokeWidth={1.8} />
    : <span aria-hidden>{label.slice(0, 1).toUpperCase()}</span>;
}

/**
 * Roving tabindex: only one button is tabbable — the focused one, or the
 * first when no button has been focused yet (`focusedIndex === -1`).
 */
export function rovingTabIndex(idx: number, focusedIndex: number): 0 | -1 {
  return idx === (focusedIndex === -1 ? 0 : focusedIndex) ? 0 : -1;
}

/** Ref callback that keeps `refs` in sync with the mounted button at `idx`. */
export function buttonRefSetter(
  refs: Map<number, HTMLButtonElement>,
  idx: number,
): (el: HTMLButtonElement | null) => void {
  return (el) => {
    if (el) refs.set(idx, el);
    else refs.delete(idx);
  };
}

export interface SelectionRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Viewport rect spanning the current selection's endpoints (min 1px each side). */
export function selectionRect(editor: Editor): SelectionRect {
  const { from, to } = editor.state.selection;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
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

/** Per-action state snapshot selected via `useEditorState`. */
export interface ActionStateEntry {
  id: string;
  active: boolean;
  disabled: boolean;
}

export function snapshotActionStates(
  editor: Editor,
  actions: readonly InkioToolbarAction[],
): ActionStateEntry[] {
  return actions.map((action) => ({
    id: action.id,
    active: action.isActive?.(editor) ?? false,
    disabled: action.isDisabled?.(editor) ?? false,
  }));
}
