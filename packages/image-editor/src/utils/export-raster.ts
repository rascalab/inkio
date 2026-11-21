import Konva from 'konva';
import type { Annotation, ImageEditorState } from '../types';
import { STICKER_FONT_FAMILY } from '../constants';
import { applyImageFilter, resolveEffectiveFilter } from './filters';
import { getAnnotationScale, getBaseDisplayDimensions } from './geometry';
import { getRedactionCacheRatio } from './raster-limits';
import { getTextAnnotationHeight, resolveTextFontSizePx, TEXT_DEFAULT_FONT_FAMILY } from './text-metrics';

export type ExportScene = Pick<ImageEditorState,
  'originalWidth' | 'originalHeight' | 'transform' | 'annotations' | 'filter' | 'finetune'
> & { width: number; height: number };

export type RasterCanvas = HTMLCanvasElement | OffscreenCanvas;
type ExportImage = HTMLImageElement | ImageBitmap;

const MAX_SAVE_PREVIEW_SIDE = 1200;

export type ExportOutput = 'data-url' | 'blob' | 'blob-with-preview';
export type ExportWithPreview = { blob: Blob; preview: Blob };
export type ExportResult = string | Blob | ExportWithPreview;

export function verifyEncodedBlob(blob: Blob | null, mimeType: string): Blob {
  if (!blob?.size || blob.type !== mimeType) {
    throw new Error(`Could not encode the canvas as ${mimeType}`);
  }
  return blob;
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function encodeExportCanvas(
  canvas: RasterCanvas,
  output: ExportOutput,
  encode: (canvas: RasterCanvas) => Promise<Blob>,
): Promise<ExportResult> {
  let blob: Blob;
  let previewCanvas: RasterCanvas | undefined;
  try {
    blob = await encode(canvas);
    if (output === 'blob-with-preview') {
      const scale = MAX_SAVE_PREVIEW_SIDE / Math.max(canvas.width, canvas.height);
      if (scale >= 1) return { blob, preview: blob };
      // Downsample the final pixels once, without decoding the full encoded file or rerasterizing the scene.
      const width = Math.max(1, Math.round(canvas.width * scale));
      const height = Math.max(1, Math.round(canvas.height * scale));
      if ('convertToBlob' in canvas) {
        previewCanvas = new OffscreenCanvas(width, height);
      } else {
        previewCanvas = Konva.Util.createCanvasElement();
        previewCanvas.width = width;
        previewCanvas.height = height;
      }
      const context = previewCanvas.getContext('2d');
      if (!context) throw new Error('Could not create an image preview context.');
      context.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
      return { blob, preview: await encode(previewCanvas) };
    }
  } finally {
    canvas.width = canvas.height = 0;
    if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
  }
  return output === 'blob' ? blob : readDataUrl(blob);
}

function applyAnnotationToGroup(
  container: Konva.Group,
  ann: Annotation,
  scale: number,
  sourceImage: ExportImage,
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
      const pixelRatio = getRedactionCacheRatio(region.width(), region.height());
      if (ann.mode === 'blur') {
        region.blurRadius(Math.max(1, ann.strength * 0.75 * pixelRatio));
        region.filters([Konva.Filters.Blur]);
      } else {
        region.pixelSize(Math.max(2, Math.round(ann.strength * pixelRatio)));
        region.filters([Konva.Filters.Pixelate]);
      }
      region.cache({ pixelRatio });
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

export function renderExportScene(state: ExportScene, sourceImage: ExportImage, filteredBase?: RasterCanvas): HTMLCanvasElement {
  const { width: outW, height: outH, transform } = state;
  const { rotation, crop } = transform;
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(outW, outH, rotation);
  const flipX = transform.flipX ? -1 : 1;
  const flipY = transform.flipY ? -1 : 1;

  // The same detached scene runs on the DOM and worker canvas backends.
  // It needs no Stage/Layer hit surfaces or device-DPR backing stores.
  const scene = new Konva.Group();
  try {
    const placement = {
      x: outW / 2,
      y: outH / 2,
      offsetX: baseW / 2,
      offsetY: baseH / 2,
      rotation,
      scaleX: flipX,
      scaleY: flipY,
    };
    const imageNode = new Konva.Image({
      ...placement,
      image: filteredBase ?? sourceImage,
      width: baseW,
      height: baseH,
    });
    if (crop && !filteredBase) imageNode.crop(crop);
    scene.add(imageNode);

    // Match the preview filter pipeline; neutral output needs no raster cache.
    if (!filteredBase && resolveEffectiveFilter(state.filter, state.finetune).filters.length > 0) {
      applyImageFilter(imageNode, state.filter, state.finetune);
    }

    // Project original-space annotations into cropped output space before
    // applying the same rotation and flips as the image.
    const annotationScale = getAnnotationScale(
      transform, state.originalWidth, state.originalHeight, outW, outH,
    );
    const annScale = annotationScale.x;
    const transformGroup = new Konva.Group(placement);
    const annotationGroup = new Konva.Group({
      x: -(crop?.x ?? 0) * annScale,
      y: -(crop?.y ?? 0) * annotationScale.y,
      scaleY: annotationScale.y / annScale,
    });
    transformGroup.add(annotationGroup);
    scene.add(transformGroup);
    for (const annotation of state.annotations) {
      applyAnnotationToGroup(annotationGroup, annotation, annScale, sourceImage);
    }

    return scene.toCanvas({ x: 0, y: 0, width: outW, height: outH, pixelRatio: 1 });
  } finally {
    scene.destroy();
  }
}