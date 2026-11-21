import type { CropRect, ImageEditorState } from '../types';
import { getTransformedDimensions } from './geometry';
import { clampNumber } from './math';
import { isImageTainted } from './image-loader';
import { MAX_EXPORT_PIXELS, MAX_EXPORT_DIMENSION } from './raster-limits';
import {
  encodeExportCanvas, renderExportScene, verifyEncodedBlob,
  type ExportOutput, type ExportResult, type ExportScene, type ExportWithPreview, type RasterCanvas,
} from './export-raster';
import type { ExportWorkerRequest } from './export-raster.worker';
import { createExportWorker } from './export-worker-launcher';
import { renderFilteredBase, yieldExportTask } from './export-filter-bands';
import { resolveEffectiveFilter } from './filters';

const WORKER_MIN_PIXELS = 2_000_000;
const WORKER_TIMEOUT_MS = 30_000;

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export { MAX_EXPORT_DIMENSION, MAX_EXPORT_PIXELS } from './raster-limits';

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
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Invalid export dimensions ${String(width)}x${String(height)}`);
  }
  if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION) {
    throw new RangeError(
      `Export ${Math.round(width)}x${Math.round(height)} exceeds max side ${MAX_EXPORT_DIMENSION}px`,
    );
  }
  if (width * height > MAX_EXPORT_PIXELS) {
    throw new RangeError(
      `Export ${Math.round(width)}x${Math.round(height)} exceeds ${MAX_EXPORT_PIXELS}-pixel limit`,
    );
  }
}

/**
 * Clamp a crop rect into image bounds. A stale out-of-bounds or degenerate
 * crop would otherwise blank or throw inside the offscreen Konva stage,
 * far from the actual cause.
 */
export function normalizeExportCrop(
  crop: CropRect | null | undefined,
  imageWidth: number,
  imageHeight: number,
): CropRect | null {
  if (!crop) return null;
  const coords = [crop.x, crop.y, crop.width, crop.height];
  if (!coords.every(Number.isFinite)) {
    throw new Error(`Invalid crop rect ${JSON.stringify(crop)}`);
  }
  const x = clampNumber(crop.x, 0, imageWidth);
  const y = clampNumber(crop.y, 0, imageHeight);
  const width = clampNumber(crop.width, 0, imageWidth - x);
  const height = clampNumber(crop.height, 0, imageHeight - y);
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid crop rect ${JSON.stringify(crop)}`);
  }
  return { x, y, width, height };
}

function canRenderInWorker(scene: ExportScene): boolean {
  if (scene.width * scene.height < WORKER_MIN_PIXELS
    || typeof Worker === 'undefined' || typeof createImageBitmap !== 'function'
    || typeof OffscreenCanvas === 'undefined' || typeof OffscreenCanvas.prototype.convertToBlob !== 'function') {
    return false;
  }
  // Workers do not inherit document @font-face faces or direction. Keep
  // text and emoji on the DOM backend when those inputs can affect glyphs.
  return !scene.annotations.some((annotation) => annotation.type === 'text' || annotation.type === 'sticker')
    || (!document.fonts?.size && getComputedStyle(document.documentElement).direction !== 'rtl');
}

async function decodeLocalExportImage(image: HTMLImageElement): Promise<ImageBitmap | undefined> {
  const { currentSrc: src, naturalWidth, naturalHeight } = image;
  if (!/^(?:data|blob):/i.test(src) || typeof createImageBitmap !== 'function') return;
  // A Blob takes the browser's background decode path without refetching a remote URL.
  try {
    const response = await fetch(src);
    const bitmap = await createImageBitmap(await response.blob());
    if (bitmap.width === naturalWidth && bitmap.height === naturalHeight) return bitmap;
    bitmap.close();
  } catch {
    // The local URL may be revoked or excluded by connect-src; the image is already loaded.
  }
}

async function renderInWorker(
  image: HTMLImageElement,
  scene: ExportScene,
  mimeType: string,
  quality: number,
  output: ExportOutput,
): Promise<ExportResult | null> {
  let bitmap: ImageBitmap | undefined;
  let worker: Worker | undefined;
  let timeout: number | undefined;
  try {
    bitmap = (await decodeLocalExportImage(image)) ?? await createImageBitmap(image);
    if (bitmap.width !== image.naturalWidth || bitmap.height !== image.naturalHeight) return null;
    worker = await createExportWorker();
    const request: ExportWorkerRequest = { scene, image: bitmap, mimeType, quality, output };
    const exportWorker = worker;
    return await new Promise<ExportResult | null>((resolve) => {
      timeout = window.setTimeout(() => resolve(null), WORKER_TIMEOUT_MS);
      exportWorker.onmessage = ({ data }: MessageEvent<ExportResult | null>) => resolve(data);
      exportWorker.onmessageerror = exportWorker.onerror = () => resolve(null);
      exportWorker.postMessage(request, [request.image]);
    });
  } catch {
    // Creation/transfer can throw (e.g. CSP or browser support). The same
    // scene is rendered once on the DOM backend rather than retried.
    return null;
  } finally {
    window.clearTimeout(timeout);
    worker?.terminate();
    bitmap?.close();
  }
}

export function encodeCanvas(canvas: Pick<HTMLCanvasElement, 'toBlob'>, mimeType: string, quality: number): Promise<Blob> {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality))
    .then((blob) => verifyEncodedBlob(blob, mimeType));
}

export function exportCanvas(state: ImageEditorState, format?: ExportFormat, quality?: number): Promise<string>;
export function exportCanvas(state: ImageEditorState, format: ExportFormat, quality: number, output: 'blob'): Promise<Blob>;
export function exportCanvas(state: ImageEditorState, format: ExportFormat, quality: number, output: 'blob-with-preview'): Promise<ExportWithPreview>;
export async function exportCanvas(
  state: ImageEditorState,
  format: ExportFormat = 'png',
  quality = 0.92,
  output: ExportOutput = 'data-url',
): Promise<ExportResult> {
  const image = state.originalImage;
  if (!image) {
    throw new Error('No image loaded');
  }

  const safeFormat = validateExportFormat(format);
  const safeQuality = validateExportQuality(quality);

  const size = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );
  const outW = Math.round(size.width);
  const outH = Math.round(size.height);
  validateExportDimensions(outW, outH);

  if (typeof document === 'undefined') {
    throw new Error('Export requires a browser environment');
  }

  const exportCrop = normalizeExportCrop(
    state.transform.crop,
    state.originalWidth,
    state.originalHeight,
  );

  // Fail before the heavy offscreen raster work: a CORS-fallback source
  // taints the canvas and would throw a bare SecurityError when encoded.
  if (isImageTainted(image)) {
    throw new Error(
      'Cannot export: the source image was loaded without CORS approval ' +
        '(canvas is tainted). Serve the image with Access-Control-Allow-Origin or load it from a data: URL.',
    );
  }

  const scene: ExportScene = {
    width: outW,
    height: outH,
    originalWidth: state.originalWidth,
    originalHeight: state.originalHeight,
    transform: { ...state.transform, crop: exportCrop },
    annotations: state.annotations,
    filter: state.filter,
    finetune: state.finetune,
  };
  const mimeType = `image/${safeFormat}`;
  if (canRenderInWorker(scene)) {
    const result = await renderInWorker(image, scene, mimeType, safeQuality, output);
    if (result !== null) return result;
  }

  // Even without a worker, decode large local sources off the main thread.
  const large = outW * outH >= WORKER_MIN_PIXELS;
  const bitmap = large ? await decodeLocalExportImage(image) : undefined;
  let canvas: RasterCanvas;
  let filtered: RasterCanvas | undefined;
  try {
    await yieldExportTask();
    const source = bitmap ?? image;
    const effective = large ? resolveEffectiveFilter(scene.filter, scene.finetune) : undefined;
    if (effective?.filters.length) filtered = await renderFilteredBase(scene, source, effective);
    if (filtered && !scene.annotations.length && scene.transform.rotation % 360 === 0
        && !scene.transform.flipX && !scene.transform.flipY) {
      canvas = filtered;
      filtered = undefined;
    } else {
      if (filtered) await yieldExportTask();
      canvas = renderExportScene(scene, source, filtered);
    }
  } finally {
    bitmap?.close();
    if (filtered) filtered.width = filtered.height = 0;
  }
  // Do not stack the encoder's buffer snapshot on the rasterization task.
  if (large) await yieldExportTask();
  return encodeExportCanvas(canvas, output, async (target) => 'convertToBlob' in target
    ? verifyEncodedBlob(await target.convertToBlob({ type: mimeType, quality: safeQuality }), mimeType)
    : encodeCanvas(target, mimeType, safeQuality));
}
