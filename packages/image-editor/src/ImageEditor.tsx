'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { EditorCommandBar } from './chrome/EditorCommandBar';
import { CustomToolOptions } from './chrome/CustomToolOptions';
import { EditorToolbar } from './toolbar/EditorToolbar';
import { ScaleRuler } from './chrome/ScaleRuler';
import { ToolOptionsBar } from './chrome/ToolOptionsBar';
import { ImageEditorProvider } from './ImageEditorContext';
import { useElementSize } from './hooks/use-element-size';
import { useImageEditorSession } from './hooks/use-image-editor-session';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { DEFAULT_LOCALE, DEFAULT_TOOLS } from './constants';
import { EditorCanvas, type CropScaleControl } from './canvas/EditorCanvas';
import type { ImageEditorLocale, ImageEditorProps, ImageEditorToolPlacement } from './types';
import { getImageEditorToolId, normalizeTool, normalizeTools, type ResolvedImageEditorTool } from './utils/tooling';
import { ResizeDimensions } from './toolbar/options/ResizeOptions';
import { getTransformedDimensions } from './utils/geometry';
import { getPreviewScale } from './utils/raster-limits';

const PREVIEW_ZOOM_MIN = 0.25;
const PREVIEW_ZOOM_MAX = 4;

interface InnerEditorProps {
  src: string;
  active: boolean;
  onSave: ImageEditorProps['onSave'];
  onSaveBlob?: ImageEditorProps['onSaveBlob'];
  savePreview?: boolean;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveComplete?: () => void;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputQuality: number;
  enabledTools: readonly ResolvedImageEditorTool[];
  fallbackTool: ResolvedImageEditorTool | null;
  toolPlacement?: ImageEditorToolPlacement;
  locale: ImageEditorLocale;
}

function InnerEditor({
  src,
  active,
  onSave,
  onSaveBlob,
  savePreview,
  onCancel,
  onSaveComplete,
  onDirtyChange,
  outputFormat,
  outputQuality,
  enabledTools,
  fallbackTool,
  toolPlacement,
  locale,
}: InnerEditorProps) {
  const { ref: rootRef, size: rootSize } = useElementSize<HTMLDivElement>();
  const viewportKind = rootSize.width > 0 && rootSize.width <= 900 ? 'mobile' : 'desktop';
  const placement = viewportKind === 'desktop' ? toolPlacement?.desktop ?? 'left' : toolPlacement?.mobile ?? 'bottom';
  const toolsBeforeOptions = placement === 'left' || placement === 'top';
  const {
    state,
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
  } = useImageEditorSession({
    src,
    active,
    locale,
    outputFormat,
    outputQuality,
    onSave,
    onSaveBlob,
    savePreview,
    onSaveComplete,
    onDirtyChange,
    viewportKind,
  });
  const currentToolId = state.activeCustomToolId ?? normalizeTool(state.activeTool);
  const configuredTool = enabledTools.find((tool) => getImageEditorToolId(tool) === currentToolId);
  const activeTool = configuredTool ?? fallbackTool;
  const activeToolId = activeTool === null ? null : getImageEditorToolId(activeTool);
  const customTool = typeof activeTool === 'string' ? null : activeTool;
  useLayoutEffect(() => {
    if (!isSaving && !configuredTool && (currentToolId || fallbackTool)) {
      handleToolChange(fallbackTool);
    }
  }, [configuredTool, currentToolId, fallbackTool, handleToolChange, isSaving]);

  const handleKeyDown = useKeyboardShortcuts(!isSaving);
  const { ref: stageViewportRef, size: containerSize } = useElementSize<HTMLDivElement>();
  const [requestedZoom, setPreviewZoom] = useState(1);
  const [cropScale, setCropScale] = useState<CropScaleControl | null>(null);
  const activeCrop = activeTool === 'resize' ? state.pendingCrop : null;
  const dimensions = useMemo(() => getTransformedDimensions(
    state.originalWidth, state.originalHeight, state.transform, state.outputSize,
  ), [state.originalWidth, state.originalHeight, state.transform, state.outputSize]);
  const zoomLimit = useMemo(() => {
    const { width, height } = dimensions;
    const fitScale = Math.min(containerSize.width / width, containerSize.height / height);
    return fitScale > 0 && width > 0 && height > 0
      ? Math.max(1, Math.min(PREVIEW_ZOOM_MAX, getPreviewScale(width, height) / fitScale))
      : PREVIEW_ZOOM_MAX;
  }, [containerSize, dimensions]);
  const previewZoom = Math.min(requestedZoom, zoomLimit);

  const setZoom = useCallback((nextZoom: number) => {
    setPreviewZoom(Math.min(zoomLimit, Math.max(PREVIEW_ZOOM_MIN, nextZoom)));
  }, [zoomLimit]);
  const zoomPreviewBy = useCallback((factor: number) => {
    setPreviewZoom((previous) => Math.min(
      zoomLimit, Math.max(PREVIEW_ZOOM_MIN, Math.min(previous, zoomLimit) * factor),
    ));
  }, [zoomLimit]);
  const scale = activeCrop ? cropScale : null;
  const setScale = scale?.set ?? setZoom;
  const outputDimensions = activeCrop ? state.resizeOptions : dimensions;
  const customToolDisabled = isSaving || state.isLoading || !state.originalImage || Boolean(state.error);
  const isControlsVisible = customTool !== null || controls.kind === 'surface';
  const toolbar = enabledTools.length > 0 && (
    <EditorToolbar
      key="tools"
      activeTool={activeToolId}
      enabledTools={enabledTools}
      locale={locale}
      onToolChange={handleToolChange}
      viewportKind={viewportKind}
      disabled={isSaving}
    />
  );
  // e2e reads these debug attributes from production builds, so they stay
  // on; memoizing by object identity keeps JSON serialization off the
  // per-frame render path (drags, zoom, unrelated state updates).
  const debugSelectedAnnotation = useMemo(
    () => (selectedAnnotation ? JSON.stringify(selectedAnnotation) : ''),
    [selectedAnnotation],
  );
  const debugPendingCrop = useMemo(
    () => (state.pendingCrop ? JSON.stringify(state.pendingCrop) : ''),
    [state.pendingCrop],
  );

  useEffect(() => {
    if (!state.originalImage) {
      return;
    }

    setPreviewZoom(1);
  }, [state.originalImage]);

  const preventWhileSaving = (event: SyntheticEvent) => {
    if (!isSaving) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={rootRef}
      className="inkio-ie-root"
      aria-busy={isSaving}
      onClickCapture={preventWhileSaving}
      onPointerDownCapture={preventWhileSaving}
      onKeyDownCapture={preventWhileSaving}
      onKeyDown={handleKeyDown}
      data-testid="inkio-ie-root"
      data-viewport-kind={viewportKind}
      data-crop-mode={Boolean(activeCrop)}
      data-controls-open={isControlsVisible ? 'true' : 'false'}
      data-debug-dirty={isDirty ? 'true' : 'false'}
      data-debug-preview-zoom={previewZoom.toFixed(4)}
      data-debug-active-tool={activeToolId ?? ''}
      data-debug-filter={state.filter}
      data-debug-selected-id={selectedAnnotation?.id ?? ''}
      data-debug-selected-type={selectedAnnotation?.type ?? ''}
      data-debug-selected-annotation={debugSelectedAnnotation}
      data-debug-annotation-count={String(state.annotations.length)}
      data-debug-output-size={state.outputSize ? `${state.outputSize.width}x${state.outputSize.height}` : ''}
      data-debug-pending-crop={debugPendingCrop}
      data-debug-image-width={String(state.originalWidth)}
      data-debug-image-height={String(state.originalHeight)}
      data-debug-canvas-width={String(Math.round(containerSize.width))}
      data-debug-canvas-height={String(Math.round(containerSize.height))}
      data-debug-resolved-panel={customTool?.id ?? (controls.kind === 'surface' ? controls.panel : '')}
      data-debug-chrome-kind={customTool
        ? (viewportKind === 'desktop' ? 'dock' : 'strip')
        : (controls.kind === 'surface' ? controls.surface : 'none')}
      data-debug-unsupported="false"
    >
      <div className="inkio-ie-body" data-viewport-kind={viewportKind}>
        <div
          className="inkio-ie-viewport"
          data-testid="inkio-ie-viewport"
          data-viewport-kind={viewportKind}
          data-tool-placement={placement}
          data-has-tools={enabledTools.length > 0}
          data-controls-open={isControlsVisible ? 'true' : 'false'}
        >
          <div className="inkio-ie-overlay-host" />
          <EditorCommandBar
            locale={locale}
            viewportKind={viewportKind}
            canUndo={canUndo}
            canRedo={canRedo}
            isSaving={isSaving}
            isLoading={state.isLoading || Boolean(state.error)}
            onClose={onCancel}
            onUndo={undo}
            onRedo={redo}
            onSave={handleSave}
          />
          {toolsBeforeOptions && toolbar}
          {customTool ? (
            <ToolOptionsBar viewportKind={viewportKind}>
              <CustomToolOptions
                key={customTool.id}
                tool={customTool}
                viewport={viewportKind}
                disabled={customToolDisabled}
                outputSize={dimensions}
                isSavePending={isSavePending}
              />
            </ToolOptionsBar>
          ) : controls.kind === 'surface' ? (
            <ToolOptionsBar panel={controls.panel} viewportKind={viewportKind} />
          ) : null}
          <div className="inkio-ie-stage-viewport" ref={stageViewportRef}>
            {saveError && (
              <div className="inkio-ie-save-error" role="alert">{saveError}</div>
            )}
            {state.isLoading && (
              <div className="inkio-ie-loading-overlay">
                <div className="inkio-ie-spinner" />
                <span>{locale.loading}</span>
              </div>
            )}
            {state.error && !state.isLoading && (
              <div className="inkio-ie-error-overlay" role="alert">
                <span>{state.error}</span>
              </div>
            )}
            {!state.isLoading && !state.error && containerSize.width > 0 && containerSize.height > 0 && (
              <EditorCanvas
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                previewZoom={previewZoom}
                onPreviewZoomFactor={zoomPreviewBy}
                onCropScaleChange={setCropScale}
              />
            )}
          </div>
          <ScaleRuler
            locale={locale}
            value={scale?.value ?? previewZoom}
            min={scale?.min ?? PREVIEW_ZOOM_MIN}
            max={scale?.max ?? zoomLimit}
            onChange={setScale}
            onFit={() => setScale(1)}
            width={outputDimensions.width}
            height={outputDimensions.height}
            disabled={isSaving || state.isLoading || Boolean(state.error)}
            dimensionsControl={viewportKind === 'mobile' && !customTool && controls.kind === 'surface' && controls.panel === 'resize'
              ? <ResizeDimensions />
              : undefined}
          />
          {!toolsBeforeOptions && toolbar}
        </div>
      </div>
    </div>
  );
}

export function ImageEditor(props: ImageEditorProps) {
  return <ImageEditorWorkbench {...props} />;
}

export function ImageEditorWorkbench({
  src,
  active = true,
  onSave,
  onSaveBlob,
  savePreview,
  onCancel,
  onSaveComplete,
  outputFormat = 'png',
  outputQuality = 0.92,
  tools = DEFAULT_TOOLS,
  defaultTool,
  toolPlacement,
  locale: localeProp,
  className,
  maxUndoSteps,
  onDirtyChange,
}: ImageEditorProps & { active?: boolean; onSaveComplete?: () => void }) {
  const locale: ImageEditorLocale = { ...DEFAULT_LOCALE, ...localeProp };
  const normalizedTools = useMemo(() => normalizeTools(tools), [tools]);
  const fallbackTool = useMemo(() => {
    const requestedId = normalizeTool(defaultTool ?? 'resize');
    return normalizedTools.find((tool) => getImageEditorToolId(tool) === requestedId)
      ?? normalizedTools.find((tool) => tool === 'resize')
      ?? normalizedTools[0] ?? null;
  }, [defaultTool, normalizedTools]);

  return (
    <ImageEditorProvider maxUndoSteps={maxUndoSteps} locale={locale}>
      <div className={className} style={{ width: '100%', height: '100%' }}>
        <InnerEditor
          src={src}
          active={active}
          onSave={onSave}
          onSaveBlob={onSaveBlob}
          savePreview={savePreview}
          onCancel={onCancel}
          onSaveComplete={onSaveComplete}
          outputFormat={outputFormat}
          outputQuality={outputQuality}
          enabledTools={normalizedTools}
          locale={locale}
          fallbackTool={fallbackTool}
          toolPlacement={toolPlacement}
          onDirtyChange={onDirtyChange}
        />
      </div>
    </ImageEditorProvider>
  );
}
