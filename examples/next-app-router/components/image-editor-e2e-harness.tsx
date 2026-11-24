'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageEditorModal, type ImageEditorCustomTool, type ImageEditorTool } from '@inkio/image-editor';

const photoPreset: ImageEditorCustomTool = {
  id: 'photo-preset',
  label: 'Photo preset',
  icon: <span>◐</span>,
  renderControls: ({ actions, disabled, filter }) => (
    <button
      type="button"
      className="image-editor-e2e-button"
      disabled={disabled}
      aria-pressed={filter === 'grayscale'}
      onClick={() => actions.setFilter(filter === 'grayscale' ? 'none' : 'grayscale')}
    >
      Make monochrome
    </button>
  ),
};

const customDemoTools: readonly ImageEditorTool[] = ['rotate', photoPreset, 'crop', 'resize'];

interface ImageEditorDebugState {
  annotationCount: string;
  activeTool: string;
  dirty: string;
  frameHeight: string;
  frameWidth: string;
  outputSize: string;
  previewZoom: string;
  selectedAnnotation: string;
  selectedType: string;
}

const EMPTY_DEBUG_STATE: ImageEditorDebugState = {
  annotationCount: '0',
  activeTool: '',
  dirty: 'false',
  frameHeight: '',
  frameWidth: '',
  outputSize: '',
  previewZoom: '1.0000',
  selectedAnnotation: '',
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
  const activeTool = root?.dataset.debugActiveTool ?? '';
  const rawSelectedAnnotation = root?.dataset.debugSelectedAnnotation ?? '';
  const rawSelectedType = root?.dataset.debugSelectedType ?? '';

  return {
    annotationCount: root?.dataset.debugAnnotationCount ?? '0',
    activeTool,
    dirty: root?.dataset.debugDirty ?? 'false',
    frameHeight: frame?.dataset.displayHeight ?? '',
    frameWidth: frame?.dataset.displayWidth ?? '',
    outputSize: root?.dataset.debugOutputSize ?? '',
    previewZoom: root?.dataset.debugPreviewZoom ?? '1.0000',
    selectedAnnotation: rawSelectedAnnotation,
    selectedType: rawSelectedType,
  };
}

function DebugPanel({ theme }: { theme: string }) {
  const [debugState, setDebugState] = useState<ImageEditorDebugState>(EMPTY_DEBUG_STATE);
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      setDebugState(readDebugState());
    };
    const observer = new MutationObserver((records) => {
      // The modal portals to body. Never feed the debug panel's own DOM
      // updates back into the observer or re-render the editor to report them.
      if (!frame && records.some(({ target }) => target === document.body ||
          (target instanceof Element && target.closest('.inkio-ie-portal-theme')))) {
        frame = requestAnimationFrame(sync);
      }
    });
    observer.observe(document.body, {
      subtree: true, childList: true,
      attributeFilter: ['data-debug-dirty', 'data-debug-preview-zoom', 'data-debug-active-tool',
        'data-debug-selected-type', 'data-debug-selected-annotation', 'data-debug-annotation-count',
        'data-debug-output-size', 'data-display-width', 'data-display-height'],
    });
    sync();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
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
  return (
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
      <pre data-testid="image-editor-e2e-selected-annotation">{selectedAnnotationJson || '{}'}</pre>
    </section>
  );
}

export function ImageEditorE2EHarness() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [locale, setLocale] = useState<'en' | 'ko'>('en');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [savedImage, setSavedImage] = useState<{ src: string; fullSrc?: string } | null>(null);
  const [saveAsBlob, setSaveAsBlob] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomTools, setShowCustomTools] = useState(false);

  useEffect(() => {
    setImageSrc(createFixturePng());
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const { src, fullSrc } = savedImage ?? {};
    if (!src || !fullSrc) return;
    return () => {
      URL.revokeObjectURL(fullSrc);
      if (src !== fullSrc) URL.revokeObjectURL(src);
    };
  }, [savedImage]);

  const applySquareCropPreset = useCallback(() => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="inkio-ie-tool-resize"]')?.click();

      requestAnimationFrame(() => {
        // Select by stable testid, never by position: panel order is free
        // to change without breaking the harness.
        document
          .querySelector<HTMLElement>('[data-testid="inkio-ie-crop-preset-1-1"]')
          ?.click();
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
          <label style={{ minWidth: 0, maxWidth: '100%' }}>
            Photo fixture
            <input
              type="file"
              style={{ maxWidth: '100%' }}
              accept="image/*"
              data-testid="image-editor-e2e-photo-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result !== 'string') return;
                  setShowCustomTools(false);
                  setImageSrc(reader.result);
                  setSavedImage(null);
                  setIsOpen(true);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <label>
            Language
            <select
              value={locale}
              data-testid="image-editor-e2e-locale"
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'en' || value === 'ko') setLocale(value);
              }}
            >
              <option value="en">English</option>
              <option value="ko">Korean</option>
            </select>
          </label>
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
            onClick={() => {
              setShowCustomTools(false);
              setIsOpen(true);
            }}
            disabled={!imageSrc}
          >
            Open editor
          </button>
          <button
            type="button"
            className="image-editor-e2e-button"
            onClick={() => {
              setShowCustomTools(true);
              setIsOpen(true);
            }}
            disabled={!imageSrc}
          >
            Open custom tool demo
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
          <label>
            <input
              type="checkbox"
              checked={saveAsBlob}
              onChange={(event) => setSaveAsBlob(event.target.checked)}
            />
            Save as Blob
          </label>
          <span data-testid="image-editor-e2e-open-state">Modal: {isOpen ? 'open' : 'closed'}</span>
          <span data-testid="image-editor-e2e-fixture-state" data-src={imageSrc ?? undefined}>
            Fixture: {imageSrc ? 'ready' : 'loading'}
          </span>
        </div>
      </section>

      <DebugPanel theme={theme} />

      {savedImage && (
        <section className="demo-card image-editor-e2e-saved">
          <p className="section-title">Saved Preview</p>
          <img src={savedImage.src} decoding={savedImage.fullSrc ? 'async' : undefined} alt="Saved image editor output" className="image-editor-e2e-saved-image" />
          {savedImage.fullSrc && <a href={savedImage.fullSrc} download="edited-image.png">Download full image</a>}
        </section>
      )}

      {imageSrc && (
        <ImageEditorModal
          isOpen={isOpen}
          imageSrc={imageSrc}
          imageFormat="png"
          tools={showCustomTools ? customDemoTools : undefined}
          defaultTool={showCustomTools ? photoPreset.id : undefined}
          toolPlacement={showCustomTools ? { desktop: 'right', mobile: 'top' } : undefined}
          savePreview={saveAsBlob}
          onSaveBlob={saveAsBlob ? (blob, preview) => {
            const fullSrc = URL.createObjectURL(blob);
            setSavedImage({ fullSrc, src: preview && preview !== blob ? URL.createObjectURL(preview) : fullSrc });
          } : undefined}
          onSave={(nextImage) => setSavedImage({ src: nextImage })}
          onClose={() => setIsOpen(false)}
          theme={theme}
          locale={locale}
        />
      )}
    </main>
  );
}
