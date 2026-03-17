import { useCallback, useEffect, useMemo, useState } from 'react';
import { MobileCommandBar } from './chrome/MobileCommandBar';
import { MobileToolTray } from './chrome/MobileToolTray';
import { DesktopBottomDock } from './chrome/DesktopBottomDock';
import { DesktopZoomControls } from './chrome/DesktopZoomControls';
import { ImageEditorProvider } from './ImageEditorContext';
import { useElementSize } from './hooks/use-element-size';
import { useImageEditor } from './hooks/use-image-editor';
import { useImageEditorSession } from './hooks/use-image-editor-session';
import { DEFAULT_LOCALE, DEFAULT_TOOLS } from './constants';
import { EditorCanvas } from './canvas/EditorCanvas';
import { CloseIcon } from './icons';
import { EditorToolbar } from './toolbar/EditorToolbar';
import { ToolOptionsPanel } from './toolbar/ToolOptionsPanel';
import type { EnabledToolType, ImageEditorLocale, ImageEditorProps } from './types';
import { normalizeTool, normalizeTools } from './utils/tooling';

const PREVIEW_ZOOM_MIN = 0.25;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.2;

interface InnerEditorProps {
  src: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  enabledTools: EnabledToolType[];
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
  const { ref: rootRef, size: rootSize } = useElementSize<HTMLDivElement>();
  const viewportKind = rootSize.width > 0 && rootSize.width <= 900 ? 'mobile' : 'desktop';
  const {
    state,
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
  } = useImageEditorSession({
    src,
    locale,
    outputFormat,
    outputQuality,
    onSave,
    onDirtyChange,
    viewportKind,
  });
  const { ref: stageViewportRef, size: containerSize } = useElementSize<HTMLDivElement>();
  const [previewZoom, setPreviewZoom] = useState(1);

  const setZoom = useCallback((nextZoom: number) => {
    setPreviewZoom(Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, nextZoom)));
  }, []);
  const isZoomMin = previewZoom <= PREVIEW_ZOOM_MIN + 0.001;
  const isZoomMax = previewZoom >= PREVIEW_ZOOM_MAX - 0.001;
  const isZoomFit = Math.abs(previewZoom - 1) < 0.001;
  const zoomLabel = `${Math.round(previewZoom * 100)}%`;
  const isControlsVisible = controls.kind === 'surface';

  useEffect(() => {
    if (!state.originalImage) {
      return;
    }

    setPreviewZoom(1);
  }, [state.originalImage]);

  return (
    <div
      ref={rootRef}
      className="inkio-ie-root"
      data-testid="inkio-ie-root"
      data-viewport-kind={viewportKind}
      data-controls-open={isControlsVisible ? 'true' : 'false'}
      data-debug-dirty={isDirty ? 'true' : 'false'}
      data-debug-preview-zoom={previewZoom.toFixed(4)}
      data-debug-active-tool={state.activeTool ?? ''}
      data-debug-selected-id={selectedAnnotation?.id ?? ''}
      data-debug-selected-type={selectedAnnotation?.type ?? ''}
      data-debug-annotation-count={String(state.annotations.length)}
      data-debug-output-size={state.outputSize ? `${state.outputSize.width}x${state.outputSize.height}` : ''}
      data-debug-pending-crop={state.pendingCrop ? JSON.stringify(state.pendingCrop) : ''}
      data-debug-image-width={String(state.originalWidth)}
      data-debug-image-height={String(state.originalHeight)}
      data-debug-canvas-width={String(Math.round(containerSize.width))}
      data-debug-canvas-height={String(Math.round(containerSize.height))}
      data-debug-resolved-panel={controls.kind === 'surface' ? controls.panel : ''}
      data-debug-chrome-kind={controls.kind === 'surface' ? controls.surface : 'none'}
      data-debug-unsupported="false"
    >
      <div className="inkio-ie-body" data-viewport-kind={viewportKind}>
        <div
          className="inkio-ie-viewport"
          data-testid="inkio-ie-viewport"
          data-viewport-kind={viewportKind}
          data-controls-open={isControlsVisible ? 'true' : 'false'}
        >
          <div className="inkio-ie-overlay-host" aria-hidden="true" />
          {viewportKind === 'desktop' && (
            <div className="inkio-ie-desktop-rail" data-testid="inkio-ie-desktop-rail">
              <EditorToolbar
                activeTool={normalizeTool(state.activeTool)}
                enabledTools={enabledTools}
                locale={locale}
                canUndo={canUndo}
                canRedo={canRedo}
                onToolChange={handleToolChange}
                onUndo={undo}
                onRedo={redo}
              />
            </div>
          )}
          {viewportKind === 'desktop' ? (
            <>
              <DesktopZoomControls
                locale={locale}
                zoomLabel={zoomLabel}
                isZoomMin={isZoomMin}
                isZoomMax={isZoomMax}
                isZoomFit={isZoomFit}
                onZoomOut={() => setZoom(Number((previewZoom - PREVIEW_ZOOM_STEP).toFixed(2)))}
                onZoomIn={() => setZoom(Number((previewZoom + PREVIEW_ZOOM_STEP).toFixed(2)))}
                onZoomFit={() => setZoom(1)}
              />
              <div className="inkio-ie-action-cluster" data-testid="inkio-ie-action-cluster">
                <button
                  type="button"
                  className="inkio-ie-floating-btn inkio-ie-floating-btn--ghost"
                  onClick={onCancel}
                  title={locale.cancel}
                  aria-label={locale.cancel}
                  data-testid="inkio-ie-close"
                >
                  <CloseIcon size={18} strokeWidth={2} />
                </button>
              </div>
            </>
          ) : (
            <MobileCommandBar
              locale={locale}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onClose={onCancel}
              onSave={handleSave}
              isSaving={isSaving}
              isLoading={state.isLoading}
              zoomLabel={zoomLabel}
              isZoomMin={isZoomMin}
              isZoomMax={isZoomMax}
              isZoomFit={isZoomFit}
              onZoomOut={() => setZoom(Number((previewZoom - PREVIEW_ZOOM_STEP).toFixed(2)))}
              onZoomIn={() => setZoom(Number((previewZoom + PREVIEW_ZOOM_STEP).toFixed(2)))}
              onZoomFit={() => setZoom(1)}
            />
          )}
          <div className="inkio-ie-stage-viewport" ref={stageViewportRef}>
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
            {!state.isLoading && !state.error && containerSize.width > 0 && containerSize.height > 0 && (
              <EditorCanvas
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                previewZoom={previewZoom}
                onPreviewZoomChange={setZoom}
              />
            )}
          </div>
          {viewportKind === 'desktop' && controls.kind === 'surface' && (
            <DesktopBottomDock
              locale={locale}
              onSave={handleSave}
              isSaving={isSaving}
              isLoading={state.isLoading}
            >
              <ToolOptionsPanel panel={controls.panel} viewportKind="desktop" />
            </DesktopBottomDock>
          )}
          {viewportKind === 'mobile' && controls.kind === 'surface' && (
            <div className="inkio-ie-mobile-option-strip" data-testid="inkio-ie-mobile-option-strip">
              <ToolOptionsPanel panel={controls.panel} viewportKind="mobile" />
            </div>
          )}
          {viewportKind === 'mobile' && (
            <MobileToolTray
              activeTool={normalizeTool(state.activeTool)}
              enabledTools={enabledTools}
              locale={locale}
              onToolChange={handleToolChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

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
  const normalizedTools = useMemo(() => normalizeTools(tools), [tools]);
  const normalizedDefaultTool = useMemo(() => {
    const nextTool = normalizeTool(defaultTool ?? null);
    return nextTool && normalizedTools.includes(nextTool) ? nextTool : null;
  }, [defaultTool, normalizedTools]);

  return (
    <ImageEditorProvider maxUndoSteps={maxUndoSteps} locale={locale}>
      <div className={className} style={{ width: '100%', height: '100%' }}>
        <InnerEditorWithDefaultTool
          src={src}
          onSave={onSave}
          onCancel={onCancel}
          outputFormat={outputFormat}
          outputQuality={outputQuality}
          enabledTools={normalizedTools}
          locale={locale}
          defaultTool={normalizedDefaultTool}
          onDirtyChange={onDirtyChange}
        />
      </div>
    </ImageEditorProvider>
  );
}

interface InnerEditorWithDefaultToolProps extends InnerEditorProps {
  defaultTool?: EnabledToolType | null;
}

function InnerEditorWithDefaultTool({
  defaultTool,
  ...props
}: InnerEditorWithDefaultToolProps) {
  const { dispatch } = useImageEditor();

  useEffect(() => {
    if (!defaultTool) {
      return;
    }

    dispatch({ type: 'SET_TOOL', tool: defaultTool });
  }, [defaultTool, dispatch]);

  return <InnerEditor {...props} />;
}
