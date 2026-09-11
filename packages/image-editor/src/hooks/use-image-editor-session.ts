import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasExport } from './use-canvas-export';
import { useImageEditor } from './use-image-editor';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { resolveControlsModel, type ViewportKind } from '../toolbar/ToolOptionsPanel';
import type { ImageEditorLocale, ImageEditorState, ToolType } from '../types';
import { getSelectedAnnotation } from '../utils/annotation-types';
import { loadImage } from '../utils/image-loader';
import { isResizeTool, normalizeTool } from '../utils/tooling';
import { areVisualRefsEqual, getVisualRefs, nextVisualVersion, type VisualRefs } from '../utils/visual-state';

interface UseImageEditorSessionOptions {
  src: string;
  locale: ImageEditorLocale;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  onSave: (dataUrl: string) => void;
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

  const resetDirtyBaseline = useCallback((nextState: ImageEditorState | null, nextVersion?: number) => {
    if (!nextState) {
      setBaseline(null);
    } else {
      setBaseline({ version: nextVersion ?? versionRef.current, refs: getVisualRefs(nextState) });
    }
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  useKeyboardShortcuts();

  useEffect(() => {
    loadErrorRef.current = locale.error;
  }, [locale.error]);

  useEffect(() => {
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

    if (state.pendingCrop !== null) {
      return;
    }

    dispatch({ type: 'START_RESIZE_SESSION' });
  }, [dispatch, state.activeTool, state.originalHeight, state.originalWidth, state.pendingCrop]);

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

    // Fast path: undo back to the exact baseline object restores identical
    // refs even though the version counter moved on.
    if (areVisualRefsEqual(getVisualRefs(state), baseline.refs)) {
      return false;
    }

    return versionRef.current !== baseline.version;
  }, [baseline, state]);

  useEffect(() => {
    if (isDirty) {
      onDirtyChange?.(true);
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
        return; // No-op: don't toggle off the active tool
      }

      if (isResizeTool(state.activeTool)) {
        dispatch({ type: 'DISCARD_RESIZE_SESSION' });
      }

      dispatch({ type: 'SELECT_ANNOTATION', id: null });
      dispatch({ type: 'SET_TOOL', tool: nextTool });
    },
    [dispatch, state.activeTool],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      const isResizeSessionActive = isResizeTool(state.activeTool);
      const exportState = isResizeSessionActive
        ? buildResizeSessionExportState(state)
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

      if (isResizeSessionActive) {
        dispatch({ type: 'COMMIT_RESIZE_SESSION' });
      } else if (state.pendingCrop) {
        dispatch({ type: 'APPLY_CROP' });
      }

      const dataUrl = await exportToDataURL(outputFormat, outputQuality, exportState);
      onSave(dataUrl);
      // The commit above bumps the version by exactly one on the next render
      // (new transform/outputSize refs), so anticipate it to stay clean.
      resetDirtyBaseline(exportState, versionRef.current + (isResizeSessionActive || state.pendingCrop ? 1 : 0));
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: locale.error });
      console.error('[ImageEditor] Export failed:', err);
    } finally {
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
    isDirty,
    selectedAnnotation,
    controls,
    handleToolChange,
    handleSave,
  };
}

function buildResizeSessionExportState(state: ImageEditorState): ImageEditorState {
  return {
    ...state,
    transform: {
      ...state.transform,
      crop: state.pendingCrop ?? state.transform.crop,
    },
    outputSize: {
      width: state.resizeOptions.width,
      height: state.resizeOptions.height,
    },
    pendingCrop: null,
  };
}
