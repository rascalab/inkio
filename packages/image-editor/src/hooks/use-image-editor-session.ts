import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  active?: boolean;
  locale: ImageEditorLocale;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  onSave: ImageEditorProps['onSave'];
  onSaveBlob?: ImageEditorProps['onSaveBlob'];
  savePreview?: boolean;
  onSaveComplete?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  viewportKind: ViewportKind;
}

export function useImageEditorSession({
  src,
  active = true,
  locale,
  outputFormat,
  outputQuality,
  onSave,
  onSaveBlob,
  savePreview,
  onSaveComplete,
  onDirtyChange,
  viewportKind,
}: UseImageEditorSessionOptions) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useImageEditor();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef<AbortController | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSavePending = useCallback(() => savingRef.current !== null, []);
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

  useLayoutEffect(() => {
    // A controlled modal can stay mounted during its exit animation.
    if (!active) return;
    setIsSaving(false);
    setSaveError(null);
    dispatch({ type: 'START_IMAGE_LOAD' });

    let cancelled = false;

    loadImage(src)
      .then((img) => {
        if (cancelled) {
          return;
        }

        dispatch({ type: 'SET_IMAGE', image: img, width: img.naturalWidth, height: img.naturalHeight });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        const { error, geometry } = loadErrorRef.current;
        dispatch({ type: 'SET_ERROR', error: (err instanceof RangeError ? geometry : error) ?? error });
        console.error('[ImageEditor] Failed to load image:', err);
      });

    return () => {
      savingRef.current?.abort();
      cancelled = true;
      savingRef.current = null;
    };
  }, [active, dispatch, src]);

  const startResizeSession = useEffectEvent(() => {
    if (!isResizeTool(state.activeTool) || state.pendingCrop
      || state.originalWidth <= 0 || state.originalHeight <= 0) return;
    dispatch({ type: 'START_RESIZE_SESSION' });
  });
  useEffect(() => {
    startResizeSession();
  }, [state.activeTool, state.originalHeight, state.originalImage, state.originalWidth]);

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
    if (!active || savingRef.current) return;
    if (!isDirty && onSaveComplete) {
      onSaveComplete();
      return;
    }
    const save = new AbortController();
    savingRef.current = save;
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
        if (savingRef.current !== save) return;
        exporting = false;
        await onSaveBlob(blob, preview, save.signal);
      } else if (onSaveBlob) {
        const blob = await exportCanvas(exportState, outputFormat, outputQuality, 'blob');
        if (savingRef.current !== save) return;
        exporting = false;
        await onSaveBlob(blob, undefined, save.signal);
      } else {
        const dataUrl = await exportCanvas(exportState, outputFormat, outputQuality);
        if (savingRef.current !== save) return;
        exporting = false;
        await onSave(dataUrl, save.signal);
      }
      if (savingRef.current !== save) return;
      // Failed persistence must leave the crop/resize draft intact for retry.
      if (isResizeSessionActive) {
        dispatch({ type: 'COMMIT_RESIZE_SESSION' });
      } else if (state.pendingCrop) {
        dispatch({ type: 'APPLY_CROP' });
      }
      // Use the projected commit to distinguish real changes from closing a clean crop draft.
      resetDirtyBaseline(exportState, nextVisualVersion(state, saveBaseVersion, exportState));
    } catch (err) {
      if (savingRef.current !== save) return;
      setSaveError((exporting && err instanceof RangeError ? locale.outputSizeError : locale.error) ?? locale.error);
      console.error('[ImageEditor] Save failed:', err);
      return;
    } finally {
      if (savingRef.current === save) {
        savingRef.current = null;
        setIsSaving(false);
      }
    }
    // Closing may synchronously unmount the editor. Release the completed save first.
    onSaveComplete?.();
  }, [active, dispatch, isDirty, locale.error, locale.outputSizeError, onSave, onSaveBlob, onSaveComplete, outputFormat, outputQuality, resetDirtyBaseline, savePreview, state]);

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
