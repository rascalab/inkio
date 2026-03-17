import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasExport } from './use-canvas-export';
import { useImageEditor } from './use-image-editor';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { resolveControlsModel, type ViewportKind } from '../toolbar/ToolOptionsPanel';
import type { ImageEditorLocale, ImageEditorState, ToolType } from '../types';
import { getSelectedAnnotation } from '../utils/annotation-types';
import { loadImage } from '../utils/image-loader';
import { isResizeTool, normalizeTool } from '../utils/tooling';
import { getVisualStateSnapshot } from '../utils/visual-state';

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
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const loadErrorRef = useRef(locale.error);

  const resetDirtyBaseline = useCallback((nextState: ImageEditorState | null) => {
    setBaselineSnapshot(nextState ? getVisualStateSnapshot(nextState) : null);
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
    if (!state.originalImage || !baselineSnapshot) {
      return false;
    }

    return baselineSnapshot !== getVisualStateSnapshot(state);
  }, [baselineSnapshot, state.originalImage, state.transform, state.pendingCrop, state.outputSize, state.annotations]);

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

  const closeChrome = useCallback(() => {
    if (isResizeTool(state.activeTool)) {
      dispatch({ type: 'DISCARD_RESIZE_SESSION' });
    }

    dispatch({ type: 'SELECT_ANNOTATION', id: null });
    dispatch({ type: 'SET_TOOL', tool: null });
  }, [dispatch, state.activeTool]);

  const handleToolChange = useCallback(
    (tool: ToolType) => {
      const nextTool = normalizeTool(tool);
      const currentTool = normalizeTool(state.activeTool);

      if (currentTool === nextTool) {
        closeChrome();
        return;
      }

      if (isResizeTool(state.activeTool)) {
        dispatch({ type: 'DISCARD_RESIZE_SESSION' });
      }

      dispatch({ type: 'SELECT_ANNOTATION', id: null });
      dispatch({ type: 'SET_TOOL', tool: nextTool });
    },
    [closeChrome, dispatch, state.activeTool],
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
      resetDirtyBaseline(exportState);
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
