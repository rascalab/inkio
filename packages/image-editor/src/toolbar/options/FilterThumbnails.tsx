import { useEffect, useState } from 'react';
import Konva from 'konva';
import { useImageEditor } from '../../hooks/use-image-editor';
import type { FilterPresetId } from '../../types';
import { FILTER_PRESETS, applyImageFilter } from '../../utils/filters';

const THUMB_WIDTH = 72;
const THUMB_MAX_HEIGHT = 72;

function thumbnailHeight(sourceWidth: number, sourceHeight: number): number {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return THUMB_MAX_HEIGHT;
  }

  return Math.max(24, Math.min(THUMB_MAX_HEIGHT, Math.round((THUMB_WIDTH * sourceHeight) / sourceWidth)));
}

/**
 * Pintura-style filter picker: live thumbnail previews rendered through the
 * same Konva filter pipeline as the canvas. Thumbnails render one preset per
 * animation frame so 9 full `cache()` + `toDataURL()` passes never block a
 * single frame; each button falls back to its text label until its preview
 * lands (or if the source is tainted).
 */
export function FilterThumbnails() {
  const { state, dispatch, locale } = useImageEditor();
  const [thumbnails, setThumbnails] = useState<Partial<Record<FilterPresetId, string>>>({});

  useEffect(() => {
    const source = state.originalImage;
    if (!source || source.naturalWidth === 0) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    const height = thumbnailHeight(source.naturalWidth, source.naturalHeight);

    const renderOne = (index: number): void => {
      if (cancelled) return;
      const preset = FILTER_PRESETS[index];
      if (!preset) return;

      // Small fixed-size offscreen render: full-res source downscaled into
      // a 72px-wide stage keeps each cache()/toDataURL() pass cheap.
      let stage: Konva.Stage | null = null;
      try {
        stage = new Konva.Stage({
          container: document.createElement('div'),
          width: THUMB_WIDTH,
          height,
        });
        const layer = new Konva.Layer();
        stage.add(layer);
        const node = new Konva.Image({ image: source, width: THUMB_WIDTH, height });
        layer.add(node);
        applyImageFilter(node, preset.id);
        layer.batchDraw();
        const dataUrl = stage.toDataURL({ mimeType: 'image/png' });
        if (!cancelled) {
          setThumbnails((prev) => (prev[preset.id] === dataUrl ? prev : { ...prev, [preset.id]: dataUrl }));
        }
      } catch {
        // CORS-tainted source or headless canvas: keep the label fallback.
      } finally {
        stage?.destroy();
      }

      if (!cancelled && index + 1 < FILTER_PRESETS.length) {
        frameId = requestAnimationFrame(() => renderOne(index + 1));
      }
    };

    setThumbnails({});
    // Let the current frame paint first so thumbnail work never blocks the
    // panel opening animation.
    frameId = requestAnimationFrame(() => renderOne(0));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [state.originalImage]);

  return (
    <div className="inkio-ie-filter-thumbs" role="group" aria-label={locale.filter}>
      {FILTER_PRESETS.map((preset) => {
        const label = locale[preset.labelKey];
        const active = state.filter === preset.id;
        const preview = thumbnails[preset.id];
        return (
          <button
            key={preset.id}
            type="button"
            className={`inkio-ie-filter-thumb${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => dispatch({ type: 'SET_FILTER', filter: preset.id })}
            data-testid={`inkio-ie-filter-${preset.id}`}
          >
            {preview ? (
              <img
                className="inkio-ie-filter-thumb-img"
                src={preview}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            ) : (
              <span className="inkio-ie-filter-thumb-fallback" aria-hidden="true">
                {label.slice(0, 2)}
              </span>
            )}
            <span className="inkio-ie-filter-thumb-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
