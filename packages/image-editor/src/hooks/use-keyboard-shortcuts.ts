import { useEffect } from 'react';
import { useImageEditor } from './use-image-editor';

export function useKeyboardShortcuts() {
  const { undo, redo, canUndo, canRedo, state, dispatch } = useImageEditor();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const isMeta = e.ctrlKey || e.metaKey;

      if (isMeta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (isMeta && e.key === 'z') {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedAnnotationId) {
        // Only handle if not focused on an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        dispatch({ type: 'DELETE_ANNOTATION', id: state.selectedAnnotationId });
        return;
      }

      if (e.key === 'Escape') {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    state.activeTool,
    state.selectedAnnotationId,
    state.pendingCrop,
    dispatch,
  ]);
}
