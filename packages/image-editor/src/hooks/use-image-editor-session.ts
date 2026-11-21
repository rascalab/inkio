import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportCanvas } from '../utils/export-canvas';
import { useImageEditor } from './use-image-editor';
import { resolveControlsModel, type ViewportKind } from '../utils/controls-model';
import type { ImageEditorLocale, ImageEditorProps, ImageEditorState } from '../types';
import { getSelectedAnnotation } from '../utils/annotation-types';
import { loadImage } from '../utils/image-loader';
import { isResizeTool, normalizeTool, type ResolvedImageEditorTool } from '../utils/tooling';
import { areVisualRefsEqual, getVisualRefs, nextVisualVersion, type VisualRefs } from '../utils/visual-state';
import { getTransformedDimensions } from '../utils/geometry';
import { commitResizeSession, imageEditorReducer } from '../reducer';

interface UseImageEditorSessionOptions {
  src: string;
  locale: ImageEditorLocale;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  onSave: ImageEditorProps['onSave'];
  onSaveBlob?: ImageEditorProps['onSaveBlob'];
  savePreview?: boolean;
  onUnchangedSave?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  viewportKind: ViewportKind;
}

export function useImageEditorSession({
  src,
  locale,
  outputFormat,
  outputQuality,
  onSave,
  onSaveBlob,
  savePreview,
  onUnchangedSave,
  onDirtyChange,
  viewportKind,
}: UseImageEditorSessionOptions) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useImageEditor();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSavePending = useCallback(() => savingRef.current, []);
  const [baseline, setBaseline] = useState<{ version: number; refs: VisualRefs } | null>(null);
  const loadErrorRef = useRef({ error: locale.error, geometry: locale.sourceSizeError });

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

  useEffect(() => {
    loadErrorRef.current = { error: locale.error, geometry: locale.sourceSizeError };
  }, [locale.error, locale.sourceSizeError]);

  useEffect(() => {
    setSaveError(null);
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

        const { error, geometry } = loadErrorRef.current;
        dispatch({ type: 'SET_ERROR', error: (err instanceof RangeError ? geometry : error) ?? error });
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
    (tool: ResolvedImageEditorTool | null) => {
      if (savingRef.current) return;
      const nextTool = typeof tool === 'string' ? tool : null;
      const customToolId = typeof tool === 'object' ? tool?.id : undefined;
      const currentTool = normalizeTool(state.activeTool);

      if (currentTool === nextTool && state.activeCustomToolId === customToolId) {
        if (isResizeTool(state.activeTool) && state.pendingCrop === null) {
          dispatch({ type: 'START_RESIZE_SESSION' });
        }
        return; // No-op: don't toggle off the active tool
      }

      if (isResizeTool(state.activeTool)) {
        dispatch({ type: 'DISCARD_RESIZE_SESSION' });
      }

      dispatch({ type: 'SET_TOOL', tool: nextTool, customToolId });
    },
    [dispatch, state.activeCustomToolId, state.activeTool, state.pendingCrop],
  );

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    if (!isDirty && onUnchangedSave) {
      onUnchangedSave();
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    // Capture the version of the draft represented by the exported bytes.
    const saveBaseVersion = versionRef.current;

    let exporting = true;
    try {
      const isResizeSessionActive = isResizeTool(state.activeTool);
      const exportState = isResizeSessionActive
        ? commitResizeSession(state)
        : imageEditorReducer(state, { type: 'APPLY_CROP' });

      if (onSaveBlob && savePreview) {
        const { blob, preview } = await exportCanvas(exportState, outputFormat, outputQuality, 'blob-with-preview');
        exporting = false;
        await onSaveBlob(blob, preview);
      } else if (onSaveBlob) {
        const blob = await exportCanvas(exportState, outputFormat, outputQuality, 'blob');
        exporting = false;
        await onSaveBlob(blob);
      } else {
        const dataUrl = await exportCanvas(exportState, outputFormat, outputQuality);
        exporting = false;
        await onSave(dataUrl);
      }
      // Failed persistence must leave the crop/resize draft intact for retry.
      if (isResizeSessionActive) {
        dispatch({ type: 'COMMIT_RESIZE_SESSION' });
      } else if (state.pendingCrop) {
        dispatch({ type: 'APPLY_CROP' });
      }
      // Use the projected commit to distinguish real changes from closing a clean crop draft.
      resetDirtyBaseline(exportState, nextVisualVersion(state, saveBaseVersion, exportState));
    } catch (err) {
      setSaveError((exporting && err instanceof RangeError ? locale.outputSizeError : locale.error) ?? locale.error);
      console.error('[ImageEditor] Save failed:', err);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [dispatch, isDirty, locale.error, locale.outputSizeError, onSave, onSaveBlob, onUnchangedSave, outputFormat, outputQuality, resetDirtyBaseline, savePreview, state]);

  return {
    state,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    isSaving,
    isSavePending,
    saveError,
    isDirty,
    selectedAnnotation,
    controls,
    handleToolChange,
    handleSave,
  };
}
