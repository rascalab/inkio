import { useEffect, useState } from 'react';
import { Image as KonvaImage } from 'konva/lib/shapes/Image.js';
import { useImageEditor } from '../../hooks/use-image-editor';
import type { FilterPresetId } from '../../types';
import { FILTER_PRESETS, applyImageFilter } from '../../utils/filters';
import { isImageTainted } from '../../utils/image-loader';

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
    if (!source || source.naturalWidth === 0 || isImageTainted(source)) {
      // Reset on empty source: without this a previous image's thumbnails
      // stay mounted after the source is cleared.
      setThumbnails({});
      return;
    }

    let cancelled = false;
    let frameId = 0;
    const height = thumbnailHeight(source.naturalWidth, source.naturalHeight);

    const renderOne = (index: number): void => {
      if (cancelled) return;
      const preset = FILTER_PRESETS[index];
      if (!preset) return;

      const node = new KonvaImage({ image: source, width: THUMB_WIDTH, height });
      try {
        if (preset.id !== 'none') applyImageFilter(node, preset.id);
        const dataUrl = node.toDataURL({ x: 0, y: 0, width: THUMB_WIDTH, height, mimeType: 'image/png', pixelRatio: 1 });
        setThumbnails((prev) => ({ ...prev, [preset.id]: dataUrl }));
      } catch {
        // Headless canvas: keep the label fallback.
      } finally {
        node.destroy();
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
