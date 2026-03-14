import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ImageEditorProvider } from './ImageEditorContext';
import { useImageEditor } from './hooks/useImageEditor';
import { useCanvasExport } from './hooks/useCanvasExport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { EditorToolbar } from './toolbar/EditorToolbar';
import { ToolOptionsPanel } from './toolbar/ToolOptionsPanel';
import { EditorCanvas } from './canvas/EditorCanvas';
import { loadImage } from './utils/imageLoader';
import { getVisualStateSnapshot } from './utils/visualState';
import { DEFAULT_LOCALE, DEFAULT_TOOLS } from './constants';
import { CloseIcon } from './icons';
import type { ImageEditorProps, ToolType, ImageEditorLocale } from './types';

interface InnerEditorProps {
  src: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  enabledTools: ToolType[];
  locale: ImageEditorLocale;
}

function InnerEditor({
  src,
  onSave,
  onCancel,
  onDirtyChange,
  outputFormat,
  outputQuality,
  enabledTools,
  locale,
}: InnerEditorProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useImageEditor();
  const { exportToDataURL } = useCanvasExport();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const baselineSnapshotRef = useRef<string | null>(null);

  useKeyboardShortcuts();

  // Load image on mount / src change
  useEffect(() => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    let cancelled = false;

    loadImage(src)
      .then((img) => {
        if (cancelled) return;
        dispatch({ type: 'SET_IMAGE', image: img, width: img.naturalWidth, height: img.naturalHeight });
        dispatch({ type: 'SET_LOADING', isLoading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatch({ type: 'SET_ERROR', error: locale.error });
        dispatch({ type: 'SET_LOADING', isLoading: false });
        console.error('[ImageEditor] Failed to load image:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [src, dispatch]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => observer.disconnect();
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const dataUrl = await exportToDataURL(outputFormat, outputQuality);
      onSave(dataUrl);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: locale.error });
      console.error('[ImageEditor] Export failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [exportToDataURL, outputFormat, outputQuality, onSave, dispatch, locale]);

  useEffect(() => {
    if (!state.originalImage) {
      baselineSnapshotRef.current = null;
      return;
    }

    baselineSnapshotRef.current = getVisualStateSnapshot(state);
    onDirtyChange?.(false);
    setPreviewZoom(1);
    // Snapshot reset should only happen after a new image is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.originalImage]);

  const isDirty = useMemo(() => {
    if (!state.originalImage || !baselineSnapshotRef.current) {
      return false;
    }

    return baselineSnapshotRef.current !== getVisualStateSnapshot(state);
  }, [state]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleToolChange = useCallback(
    (tool: ToolType) => {
      dispatch({ type: 'SET_TOOL', tool: state.activeTool === tool ? null : tool });
    },
    [dispatch, state.activeTool],
  );

  const setZoom = useCallback((nextZoom: number) => {
    setPreviewZoom(Math.min(4, Math.max(0.25, nextZoom)));
  }, []);

  return (
    <div className="inkio-ie-root">
      {/* Top Header */}
      <div className="inkio-ie-header">
        <button type="button" className="inkio-ie-header-close" onClick={onCancel} title={locale.cancel}>
          <CloseIcon size={20} strokeWidth={2} />
        </button>
        <div className="inkio-ie-header-title">Image Editor</div>
        <div className="inkio-ie-header-actions">
          <div className="inkio-ie-zoom-controls" role="group" aria-label={locale.zoom}>
            <button
              type="button"
              className="inkio-ie-action-btn"
              onClick={() => setZoom(previewZoom / 1.2)}
            >
              -
            </button>
            <button
              type="button"
              className="inkio-ie-action-btn"
              onClick={() => setZoom(1)}
            >
              {locale.fit}
            </button>
            <span className="inkio-ie-zoom-label">{Math.round(previewZoom * 100)}%</span>
            <button
              type="button"
              className="inkio-ie-action-btn"
              onClick={() => setZoom(previewZoom * 1.2)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="inkio-ie-btn inkio-ie-btn--primary"
            disabled={isSaving || state.isLoading}
            onClick={handleSave}
          >
            {isSaving ? `${locale.save}...` : locale.save}
          </button>
        </div>
      </div>

      <div className="inkio-ie-body">
        {/* Left Toolbar */}
        <EditorToolbar
          activeTool={state.activeTool}
          enabledTools={enabledTools}
          locale={locale}
          canUndo={canUndo}
          canRedo={canRedo}
          onToolChange={handleToolChange}
          onUndo={undo}
          onRedo={redo}
        />
        <div className="inkio-ie-main">
          <div className="inkio-ie-canvas-area" ref={containerRef}>
            {state.isLoading && (
              <div className="inkio-ie-loading-overlay">
                <div className="inkio-ie-spinner" />
                <span>{locale.loading}</span>
              </div>
            )}
            {state.error && !state.isLoading && (
              <div className="inkio-ie-error-overlay">
                <span>{state.error}</span>
              </div>
            )}
            {!state.isLoading && !state.error && containerSize.width > 0 && (
              <EditorCanvas
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                previewZoom={previewZoom}
                onPreviewZoomChange={setZoom}
              />
            )}
          </div>

          <ToolOptionsPanel activeTool={state.activeTool} />
        </div>
      </div>
    </div>
  );
};

export function ImageEditor({
  src,
  onSave,
  onCancel,
  outputFormat = 'png',
  outputQuality = 0.92,
  tools = DEFAULT_TOOLS,
  defaultTool,
  locale: localeProp,
  className,
  maxUndoSteps,
  onDirtyChange,
}: ImageEditorProps) {
  const locale: ImageEditorLocale = { ...DEFAULT_LOCALE, ...localeProp };

  return (
    <ImageEditorProvider maxUndoSteps={maxUndoSteps} locale={locale}>
      <div className={className} style={{ width: '100%', height: '100%' }}>
        <InnerEditorWithDefaultTool
          src={src}
          onSave={onSave}
          onCancel={onCancel}
          outputFormat={outputFormat}
          outputQuality={outputQuality}
          enabledTools={tools}
          locale={locale}
          defaultTool={defaultTool}
          onDirtyChange={onDirtyChange}
        />
      </div>
    </ImageEditorProvider>
  );
};

interface InnerEditorWithDefaultToolProps extends InnerEditorProps {
  defaultTool?: ToolType;
}

function InnerEditorWithDefaultTool({
  defaultTool,
  ...props
}: InnerEditorWithDefaultToolProps) {
  const { dispatch } = useImageEditor();

  useEffect(() => {
    if (defaultTool) {
      dispatch({ type: 'SET_TOOL', tool: defaultTool });
    }
  }, [defaultTool, dispatch]);

  return <InnerEditor {...props} />;
};
