import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasExport } from './use-canvas-export';
import { useImageEditor } from './use-image-editor';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { resolveControlsModel, type ViewportKind } from '../utils/controls-model';
import type { ImageEditorLocale, ImageEditorState, ToolType } from '../types';
import { getSelectedAnnotation } from '../utils/annotation-types';
import { loadImage } from '../utils/image-loader';
import { isResizeTool, normalizeTool } from '../utils/tooling';
import { areVisualRefsEqual, getVisualRefs, nextVisualVersion, type VisualRefs } from '../utils/visual-state';
import { getTransformedDimensions } from '../utils/geometry';
import { commitResizeSession } from '../reducer';

interface UseImageEditorSessionOptions {
  src: string;
  locale: ImageEditorLocale;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  onSave: (dataUrl: string) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  viewportKind: ViewportKind;
}

export function useImageEditorSession({
  src,
  locale,
  outputFormat,
  outputQuality,
  onSave,
  onDirtyChange,
  viewportKind,
}: UseImageEditorSessionOptions) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useImageEditor();
  const { exportToDataURL } = useCanvasExport();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState(false);
  const [baseline, setBaseline] = useState<{ version: number; refs: VisualRefs } | null>(null);
  const loadErrorRef = useRef(locale.error);

  // Incremental dirty version: O(1) integer bump per visual state change
  // instead of a full JSON.stringify per stroke frame. Updated during render
  // (ref writes only, no re-render triggered); StrictMode-safe because a
  // repeated render with the same state object is a no-op.
  const prevStateRef = useRef<ImageEditorState | null>(null);
  const versionRef = useRef(0);
  if (prevStateRef.current !== state) {
    versionRef.current = nextVisualVersion(prevStateRef.current, versionRef.current, state);
    prevStateRef.current = state;
  }

  // Dirty notification has a single source: the transition effect below.
  // Emitting here as well would double-notify every baseline reset.
  const resetDirtyBaseline = useCallback((nextState: ImageEditorState | null, nextVersion?: number) => {
    if (!nextState) {
      setBaseline(null);
    } else {
      setBaseline({ version: nextVersion ?? versionRef.current, refs: getVisualRefs(nextState) });
    }
  }, []);

  useKeyboardShortcuts(!isSaving);

  useEffect(() => {
    loadErrorRef.current = locale.error;
  }, [locale.error]);

  useEffect(() => {
    setSaveError(false);
    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    let cancelled = false;

    loadImage(src)
      .then((img) => {
        if (cancelled) {
          return;
        }

        dispatch({ type: 'SET_IMAGE', image: img, width: img.naturalWidth, height: img.naturalHeight });
        dispatch({ type: 'SET_LOADING', isLoading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        dispatch({ type: 'SET_ERROR', error: loadErrorRef.current });
        dispatch({ type: 'SET_LOADING', isLoading: false });
        console.error('[ImageEditor] Failed to load image:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, src]);

  useEffect(() => {
    if (!isResizeTool(state.activeTool) || state.originalWidth <= 0 || state.originalHeight <= 0) {
      return;
    }

    dispatch({ type: 'START_RESIZE_SESSION' });
  }, [dispatch, state.activeTool, state.originalHeight, state.originalWidth]);

  useEffect(() => {
    if (!state.originalImage) {
      resetDirtyBaseline(null);
      return;
    }

    resetDirtyBaseline(state);
    // Baseline resets only when a new source image finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetDirtyBaseline, state.originalImage]);

  const isDirty = useMemo(() => {
    if (!state.originalImage || !baseline) {
      return false;
    }

    if (isResizeTool(state.activeTool) && state.pendingCrop) {
      const appliedSize = getTransformedDimensions(
        state.originalWidth, state.originalHeight, state.transform, state.outputSize,
      );
      if (state.resizeOptions.width !== appliedSize.width || state.resizeOptions.height !== appliedSize.height) {
        return true;
      }
    }

    // Fast path: undo back to the exact baseline object restores identical
    // refs even though the version counter moved on.
    if (areVisualRefsEqual(getVisualRefs(state), baseline.refs)) {
      return false;
    }

    return versionRef.current !== baseline.version;
  }, [baseline, state]);

  const prevDirtyRef = useRef(false);
  useEffect(() => {
    if (isDirty !== prevDirtyRef.current) {
      prevDirtyRef.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const selectedAnnotation = useMemo(
    () => getSelectedAnnotation(state.annotations, state.selectedAnnotationId),
    [state.annotations, state.selectedAnnotationId],
  );
  const controls = useMemo(
    () => resolveControlsModel(state.activeTool, selectedAnnotation, viewportKind),
    [selectedAnnotation, state.activeTool, viewportKind],
  );

  const handleToolChange = useCallback(
    (tool: ToolType) => {
      const nextTool = normalizeTool(tool);
      const currentTool = normalizeTool(state.activeTool);

      if (currentTool === nextTool) {
        if (isResizeTool(state.activeTool) && state.pendingCrop === null) {
          dispatch({ type: 'START_RESIZE_SESSION' });
        }
        return; // No-op: don't toggle off the active tool
      }

      if (isResizeTool(state.activeTool)) {
        dispatch({ type: 'DISCARD_RESIZE_SESSION' });
      }

      dispatch({ type: 'SELECT_ANNOTATION', id: null });
      dispatch({ type: 'SET_TOOL', tool: nextTool });
    },
    [dispatch, state.activeTool, state.pendingCrop],
  );

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(false);
    // Capture the version of the draft represented by the exported bytes.
    const saveBaseVersion = versionRef.current;

    try {
      const isResizeSessionActive = isResizeTool(state.activeTool);
      const exportState = isResizeSessionActive
        ? commitResizeSession(state)
        : state.pendingCrop
          ? {
              ...state,
              transform: {
                ...state.transform,
                crop: state.pendingCrop,
              },
              pendingCrop: null,
            }
          : state;

      const dataUrl = await exportToDataURL(outputFormat, outputQuality, exportState);
      await onSave(dataUrl);
      // Failed persistence must leave the crop/resize draft intact for retry.
      if (isResizeSessionActive) {
        dispatch({ type: 'COMMIT_RESIZE_SESSION' });
      } else if (state.pendingCrop) {
        dispatch({ type: 'APPLY_CROP' });
      }
      // The commit above bumps the version by exactly one on the next render
      // (COMMIT/APPLY always mint fresh transform/outputSize refs), so the
      // post-save baseline anticipates the pre-dispatch version plus one.
      // Edits racing the export keep the flag dirty, correctly: they are not
      // in the exported bytes.
      resetDirtyBaseline(exportState, saveBaseVersion + (isResizeSessionActive || state.pendingCrop ? 1 : 0));
    } catch (err) {
      setSaveError(true);
      console.error('[ImageEditor] Save failed:', err);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [dispatch, exportToDataURL, locale.error, onSave, outputFormat, outputQuality, resetDirtyBaseline, state]);

  return {
    state,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    isSaving,
    saveError,
    isDirty,
    selectedAnnotation,
    controls,
    handleToolChange,
    handleSave,
  };
}
