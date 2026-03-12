import React, { createContext, useReducer, useCallback, useMemo } from 'react';
import {
  undoableReducer,
  makeInitialUndoableState,
  UNDOABLE_ACTIONS,
  type ImageEditorAction,
  type UndoableAction,
} from './reducer';
import type { ImageEditorState } from './types';
import type { ImageEditorLocale } from './types';
import { MAX_UNDO_STEPS } from './constants';

export interface ImageEditorContextValue {
  state: ImageEditorState;
  locale: ImageEditorLocale;
  dispatch: (action: ImageEditorAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const ImageEditorContext = createContext<ImageEditorContextValue | null>(null);

interface ImageEditorProviderProps {
  children: React.ReactNode;
  maxUndoSteps?: number;
  locale: ImageEditorLocale;
}

export function ImageEditorProvider({
  children,
  maxUndoSteps = MAX_UNDO_STEPS,
  locale,
}: ImageEditorProviderProps) {
  const [undoableState, rawDispatch] = useReducer(
    (s: ReturnType<typeof makeInitialUndoableState>, a: UndoableAction) =>
      undoableReducer(s, a, maxUndoSteps),
    undefined,
    makeInitialUndoableState,
  );

  const dispatch = useCallback(
    (action: ImageEditorAction) => {
      const isUndoable = UNDOABLE_ACTIONS.has(action.type);
      rawDispatch({ ...action, undoable: isUndoable } as UndoableAction);
    },
    [],
  );

  const undo = useCallback(() => {
    rawDispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    rawDispatch({ type: 'REDO' });
  }, []);

  const canUndo = undoableState.past.length > 0;
  const canRedo = undoableState.future.length > 0;

  const contextValue = useMemo(
    () => ({
      state: undoableState.present,
      locale,
      dispatch,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [undoableState.present, locale, dispatch, undo, redo, canUndo, canRedo],
  );

  return (
    <ImageEditorContext.Provider value={contextValue}>
      {children}
    </ImageEditorContext.Provider>
  );
};
