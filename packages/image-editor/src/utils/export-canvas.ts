import Konva from 'konva';
import type { ImageEditorState, Annotation } from '../types';
import { getTransformedDimensions, getBaseDisplayDimensions } from './geometry';
import { getTextAnnotationHeight, resolveTextFontSizePx, TEXT_DEFAULT_FONT_FAMILY } from './text-metrics';
import { applyImageFilter } from './filters';
import { STICKER_FONT_FAMILY } from '../annotations/StickerAnnotationShape';

export type ExportFormat = 'png' | 'jpeg' | 'webp';

/** Hard cap: 100 MP RGBA ≈ 400 MiB pixel buffer; refuse before allocating. */
export const MAX_EXPORT_PIXELS = 100_000_000;
export const MAX_EXPORT_DIMENSION = 16_000;

export function validateExportFormat(format: string): ExportFormat {
  if (format === 'png' || format === 'jpeg' || format === 'webp') {
    return format;
  }
  throw new Error(`Unsupported export format "${format}" (want png, jpeg, or webp)`);
}

export function validateExportQuality(quality: number): number {
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new Error(`Invalid export quality ${String(quality)} (want 0-1)`);
  }
  return quality;
}

export function validateExportDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid export dimensions ${String(width)}x${String(height)}`);
  }
  if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION) {
    throw new Error(
      `Export ${Math.round(width)}x${Math.round(height)} exceeds max side ${MAX_EXPORT_DIMENSION}px`,
    );
  }
  if (width * height > MAX_EXPORT_PIXELS) {
    throw new Error(
      `Export ${Math.round(width)}x${Math.round(height)} exceeds ${MAX_EXPORT_PIXELS}-pixel limit`,
    );
  }
}

/** Yield to the main thread so a large export doesn't freeze input handling. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function applyAnnotationToGroup(
  container: Konva.Group | Konva.Layer,
  ann: Annotation,
  scale: number,
  sourceImage: HTMLImageElement | null,
): void {
  switch (ann.type) {
    case 'rect': {
      const shape = new Konva.Rect({
        x: ann.x * scale,
        y: ann.y * scale,
        width: ann.width * scale,
        height: ann.height * scale,
        fill: ann.fill,
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        rotation: ann.rotation,
      });
      container.add(shape);
      break;
    }
    case 'ellipse': {
      const shape = new Konva.Ellipse({
        x: ann.x * scale,
        y: ann.y * scale,
        radiusX: ann.radiusX * scale,
        radiusY: ann.radiusY * scale,
        fill: ann.fill,
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        rotation: ann.rotation,
      });
      container.add(shape);
      break;
    }
    case 'arrow': {
      const shape = new Konva.Arrow({
        points: ann.points.map((p) => p * scale),
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        fill: ann.stroke,
        pointerLength: 10 * scale,
        pointerWidth: 10 * scale,
      });
      container.add(shape);
      break;
    }
    case 'line': {
      const shape = new Konva.Line({
        points: ann.points.map((p) => p * scale),
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        lineCap: 'round',
        lineJoin: 'round',
      });
      container.add(shape);
      break;
    }
    case 'text': {
      const fontSizePx = resolveTextFontSizePx(ann.fontSize);
      const shape = new Konva.Text({
        x: ann.x * scale,
        y: ann.y * scale,
        text: ann.text,
        fontSize: fontSizePx * scale,
        fontFamily: ann.fontFamily || TEXT_DEFAULT_FONT_FAMILY,
        fill: ann.fill,
        fontStyle: ann.fontStyle,
        rotation: ann.rotation,
        width: ann.width ? ann.width * scale : undefined,
        height: getTextAnnotationHeight(ann) * scale,
      });
      container.add(shape);
      break;
    }
    case 'freedraw': {
      const shape = new Konva.Line({
        points: ann.points.map((p) => p * scale),
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        opacity: ann.opacity,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: 'source-over',
      });
      container.add(shape);
      break;
    }
    case 'redact': {
      // Re-render the source region with the same filter pipeline as the
      // live RedactAnnotationShape so export matches the preview.
      if (!sourceImage) break;
      const region = new Konva.Image({
        image: sourceImage,
        x: ann.x * scale,
        y: ann.y * scale,
        width: Math.max(1, ann.width * scale),
        height: Math.max(1, ann.height * scale),
        rotation: ann.rotation,
        crop: {
          x: ann.x,
          y: ann.y,
          width: Math.max(1, ann.width),
          height: Math.max(1, ann.height),
        },
      });
      if (ann.mode === 'blur') {
        region.blurRadius(Math.max(0.5, ann.strength * 0.75));
        region.filters([Konva.Filters.Blur]);
      } else {
        region.pixelSize(Math.max(2, Math.round(ann.strength)));
        region.filters([Konva.Filters.Pixelate]);
      }
      region.cache();
      container.add(region);
      break;
    }
    case 'sticker': {
      const shape = new Konva.Text({
        x: ann.x * scale,
        y: ann.y * scale,
        text: ann.emoji,
        fontSize: Math.max(1, ann.size * scale),
        fontFamily: STICKER_FONT_FAMILY,
        rotation: ann.rotation,
      });
      container.add(shape);
      break;
    }
  }
}

export async function exportCanvas(
  state: ImageEditorState,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92,
): Promise<string> {
  if (!state.originalImage) {
    throw new Error('No image loaded');
  }

  const safeFormat = validateExportFormat(format);
  const safeQuality = validateExportQuality(quality);

  const { width: outW, height: outH } = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );
  validateExportDimensions(outW, outH);

  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    outW, outH, state.transform.rotation,
  );

  if (typeof document === 'undefined') {
    throw new Error('Export requires a browser environment');
  }

  // Let input/paint run before the heavy synchronous raster work below.
  await yieldToMain();

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none';
  document.body.appendChild(container);

  let stage: Konva.Stage | null = null;
  try {
    stage = new Konva.Stage({
      container,
      width: outW,
      height: outH,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Draw image with transforms
    const imageNode = new Konva.Image({
      image: state.originalImage,
      x: outW / 2,
      y: outH / 2,
      width: baseW,
      height: baseH,
      offsetX: baseW / 2,
      offsetY: baseH / 2,
      rotation: state.transform.rotation,
      scaleX: state.transform.flipX ? -1 : 1,
      scaleY: state.transform.flipY ? -1 : 1,
    });

    if (state.transform.crop) {
      const crop = state.transform.crop;
      imageNode.crop({
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      });
      imageNode.width(baseW);
      imageNode.height(baseH);
      imageNode.x(outW / 2);
      imageNode.y(outH / 2);
      imageNode.offsetX(baseW / 2);
      imageNode.offsetY(baseH / 2);
    }

    // Same filter pipeline as the live preview (ImageNode) so the saved
    // image matches what the user sees.
    applyImageFilter(imageNode, state.filter, state.finetune);

    layer.add(imageNode);

    // Render annotations
    // Annotations use original-image-space coordinates.
    // With crop, offset by crop origin and scale to output size.
    const cropX = state.transform.crop?.x ?? 0;
    const cropY = state.transform.crop?.y ?? 0;
    const srcW = state.transform.crop?.width ?? state.originalWidth;
    const srcH = state.transform.crop?.height ?? state.originalHeight;
    const rawAnnScale = Math.min(
      srcW > 0 ? baseW / srcW : Number.POSITIVE_INFINITY,
      srcH > 0 ? baseH / srcH : Number.POSITIVE_INFINITY,
    );
    const annScale = Number.isFinite(rawAnnScale) && rawAnnScale > 0 ? rawAnnScale : 1;

    const rotation = state.transform.rotation ?? 0;
    const flipX = state.transform.flipX ? -1 : 1;
    const flipY = state.transform.flipY ? -1 : 1;

    // Wrap annotations in a transform group matching the image node so that
    // rotation and flip are applied consistently on export.
    const transformGroup = new Konva.Group({
      x: outW / 2,
      y: outH / 2,
      rotation,
      scaleX: flipX,
      scaleY: flipY,
      offsetX: baseW / 2,
      offsetY: baseH / 2,
    });

    const annotationGroup = new Konva.Group({
      x: -cropX * annScale,
      y: -cropY * annScale,
    });
    transformGroup.add(annotationGroup);
    layer.add(transformGroup);

    for (const ann of state.annotations) {
      applyAnnotationToGroup(annotationGroup, ann, annScale, state.originalImage);
    }

    layer.batchDraw();

    const mimeType =
      safeFormat === 'jpeg' ? 'image/jpeg' : safeFormat === 'webp' ? 'image/webp' : 'image/png';

    // Large lossy exports can OOM inside the encoder: retry once at a lower
    // quality before surfacing the error instead of a blank-page crash.
    try {
      return stage.toDataURL({ mimeType, quality: safeQuality });
    } catch (err) {
      if (safeFormat === 'png' || safeQuality <= 0.6) throw err;
      await yieldToMain();
      return stage.toDataURL({ mimeType, quality: 0.6 });
    }
  } finally {
    // Always release the offscreen stage, even when toDataURL throws
    // (e.g. tainted canvas or oversized output).
    try {
      stage?.destroy();
    } catch {
      // Best-effort cleanup only.
    }
    container.remove();
  }
}
