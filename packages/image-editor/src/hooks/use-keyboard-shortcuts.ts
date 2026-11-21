import type { KeyboardEvent } from 'react';
import { useImageEditor } from './use-image-editor';

export function useKeyboardShortcuts(enabled = true) {
  const { undo, redo, canUndo, canRedo, state, dispatch } = useImageEditor();

  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || e.defaultPrevented || e.nativeEvent.isComposing || e.keyCode === 229) return;
    const target = e.target;
    // Ignore native field shortcuts and events bubbling up from nested workbenches.
    if (!(target instanceof HTMLElement) || target.closest('.inkio-ie-root') !== e.currentTarget) return;
    if (target.matches('input, textarea, select') || target.isContentEditable) return;

    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) {
        if (canRedo) redo();
      } else if (canUndo) {
        undo();
      }
      return;
    }

    if ((key === 'delete' || key === 'backspace') && state.selectedAnnotationId) {
      e.preventDefault();
      dispatch({ type: 'DELETE_ANNOTATION', id: state.selectedAnnotationId });
      return;
    }

    if (key === 'escape') {
      if ((state.activeTool === 'resize' || state.activeTool === 'crop') && state.pendingCrop) {
        dispatch({ type: 'DISCARD_RESIZE_SESSION' });
        dispatch({ type: 'SET_TOOL', tool: 'resize' });
      } else if (state.pendingCrop) {
        dispatch({ type: 'SET_PENDING_CROP', crop: null });
      } else if (state.selectedAnnotationId) {
        dispatch({ type: 'SELECT_ANNOTATION', id: null });
      }
    }
  };
}
