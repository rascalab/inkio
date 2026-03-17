'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageEditorModal } from '@inkio/image-editor';

interface ImageEditorDebugState {
  annotationCount: string;
  activeTool: string;
  canvasHeight: string;
  canvasWidth: string;
  dirty: string;
  frameHeight: string;
  frameWidth: string;
  modalOpen: boolean;
  outputSize: string;
  previewZoom: string;
  selectedAnnotation: string;
  selectedId: string;
  selectedType: string;
}

const EMPTY_DEBUG_STATE: ImageEditorDebugState = {
  annotationCount: '0',
  activeTool: '',
  canvasHeight: '',
  canvasWidth: '',
  dirty: 'false',
  frameHeight: '',
  frameWidth: '',
  modalOpen: false,
  outputSize: '',
  previewZoom: '1.0000',
  selectedAnnotation: '',
  selectedId: '',
  selectedType: '',
};

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createFixturePng(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 360;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create fixture image.');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(72, 48, 420, 280);
  gradient.addColorStop(0, 'rgba(14, 165, 233, 0.82)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.48)');
  drawRoundedRect(context, 72, 44, 360, 236, 36);
  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = 'rgba(15, 23, 42, 0.42)';
  context.lineWidth = 10;
  context.stroke();

  context.beginPath();
  context.arc(436, 112, 54, 0, Math.PI * 2);
  context.fillStyle = 'rgba(250, 204, 21, 0.94)';
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = 'rgba(120, 53, 15, 0.34)';
  context.stroke();

  context.beginPath();
  context.moveTo(120, 304);
  context.lineTo(496, 188);
  context.lineWidth = 18;
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(190, 24, 93, 0.82)';
  context.stroke();

  context.beginPath();
  context.arc(184, 146, 26, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.fill();

  return canvas.toDataURL('image/png');
}

function readDebugState(): ImageEditorDebugState {
  const root = document.querySelector<HTMLElement>('[data-testid="inkio-ie-root"]');
  const frame = document.querySelector<HTMLElement>('[data-testid="inkio-ie-stage-frame"]');
  const modal = document.querySelector<HTMLElement>('[data-testid="inkio-ie-modal-content"]');
  const activeTool = root?.dataset.debugActiveTool ?? '';
  const rawSelectedAnnotation = root?.dataset.debugSelectedAnnotation ?? '';
  const rawSelectedId = root?.dataset.debugSelectedId ?? '';
  const rawSelectedType = root?.dataset.debugSelectedType ?? '';

  return {
    annotationCount: root?.dataset.debugAnnotationCount ?? '0',
    activeTool,
    canvasHeight: root?.dataset.debugCanvasHeight ?? '',
    canvasWidth: root?.dataset.debugCanvasWidth ?? '',
    dirty: root?.dataset.debugDirty ?? 'false',
    frameHeight: frame?.dataset.displayHeight ?? '',
    frameWidth: frame?.dataset.displayWidth ?? '',
    modalOpen: Boolean(modal),
    outputSize: root?.dataset.debugOutputSize ?? '',
    previewZoom: root?.dataset.debugPreviewZoom ?? '1.0000',
    selectedAnnotation: rawSelectedAnnotation,
    selectedId: rawSelectedId,
    selectedType: rawSelectedType,
  };
}

export function ImageEditorE2EHarness() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [savedImage, setSavedImage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [debugState, setDebugState] = useState<ImageEditorDebugState>(EMPTY_DEBUG_STATE);

  useEffect(() => {
    setImageSrc(createFixturePng());
    setIsOpen(true);
  }, []);

  const syncDebugState = useCallback(() => {
    setDebugState(readDebugState());
  }, []);

  useEffect(() => {
    syncDebugState();
    const observer = new MutationObserver(() => {
      syncDebugState();
    });

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [syncDebugState]);

  const selectedAnnotationJson = useMemo(() => {
    if (!debugState.selectedAnnotation) {
      return '';
    }

    try {
      return JSON.stringify(JSON.parse(debugState.selectedAnnotation), null, 2);
    } catch {
      return debugState.selectedAnnotation;
    }
  }, [debugState.selectedAnnotation]);

  const applySquareCropPreset = useCallback(() => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="inkio-ie-tool-resize"]')?.click();

      requestAnimationFrame(() => {
        const presetButtons = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[data-testid="inkio-ie-options-panel"] .inkio-ie-preset-btn'),
        );
        presetButtons[1]?.click();
      });
    });
  }, []);

  return (
    <main className="page-shell image-editor-e2e-page inkio" data-theme={theme} data-testid="image-editor-e2e-page">
      <section className="page-intro image-editor-e2e-intro">
        <p className="eyebrow">Harness</p>
        <h1>Image Editor E2E</h1>
        <p className="page-copy">
          Dedicated Playwright harness for modal shell, canvas rendering, annotation editing, zoom, and close behavior.
        </p>
      </section>

      <section className="demo-card image-editor-e2e-controls">
        <div className="image-editor-e2e-control-row">
          <button
            type="button"
            className="image-editor-e2e-button"
            data-testid="image-editor-e2e-theme-toggle"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          >
            Theme: {theme}
          </button>
          <button
            type="button"
            className="image-editor-e2e-button"
            data-testid="image-editor-e2e-open"
            onClick={() => setIsOpen(true)}
            disabled={!imageSrc}
          >
            Open editor
          </button>
          <button
            type="button"
            className="image-editor-e2e-button"
            data-testid="image-editor-e2e-square-crop"
            onClick={applySquareCropPreset}
            disabled={!isOpen}
          >
            Square crop preset
          </button>
          <span data-testid="image-editor-e2e-open-state">Modal: {isOpen ? 'open' : 'closed'}</span>
          <span data-testid="image-editor-e2e-fixture-state">
            Fixture: {imageSrc ? 'ready' : 'loading'}
          </span>
        </div>
      </section>

      <section className="json-card image-editor-e2e-debug" data-testid="image-editor-e2e-debug">
        <p className="section-title">Debug State</p>
        <dl className="image-editor-e2e-debug-grid">
          <div>
            <dt>Theme</dt>
            <dd data-testid="image-editor-e2e-theme">{theme}</dd>
          </div>
          <div>
            <dt>Dirty</dt>
            <dd data-testid="image-editor-e2e-dirty">{debugState.dirty}</dd>
          </div>
          <div>
            <dt>Zoom</dt>
            <dd data-testid="image-editor-e2e-zoom">{debugState.previewZoom}</dd>
          </div>
          <div>
            <dt>Tool</dt>
            <dd data-testid="image-editor-e2e-active-tool">{debugState.activeTool || 'none'}</dd>
          </div>
          <div>
            <dt>Selected</dt>
            <dd data-testid="image-editor-e2e-selected-type">{debugState.selectedType || 'none'}</dd>
          </div>
          <div>
            <dt>Annotations</dt>
            <dd data-testid="image-editor-e2e-annotation-count">{debugState.annotationCount}</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd data-testid="image-editor-e2e-output-size">{debugState.outputSize || 'none'}</dd>
          </div>
          <div>
            <dt>Frame</dt>
            <dd data-testid="image-editor-e2e-frame-size">
              {debugState.frameWidth && debugState.frameHeight
                ? `${debugState.frameWidth}x${debugState.frameHeight}`
                : 'none'}
            </dd>
          </div>
        </dl>
        <pre data-testid="image-editor-e2e-selected-annotation">
          {selectedAnnotationJson || '{}'}
        </pre>
      </section>

      {savedImage && (
        <section className="demo-card image-editor-e2e-saved">
          <p className="section-title">Saved Preview</p>
          <img src={savedImage} alt="Saved image editor output" className="image-editor-e2e-saved-image" />
        </section>
      )}

      {imageSrc && (
        <ImageEditorModal
          isOpen={isOpen}
          imageSrc={imageSrc}
          imageFormat="png"
          onSave={(nextImage) => {
            setSavedImage(nextImage);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
          theme={theme}
        />
      )}
    </main>
  );
}
