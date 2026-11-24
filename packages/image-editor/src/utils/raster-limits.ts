import { Konva } from 'konva/lib/Global.js';

// Keep decoded assets and 32-bit canvas backing stores within different budgets.
export const MAX_SOURCE_DIMENSION = 8192;
export const MAX_SOURCE_PIXELS = 32_000_000;
export const MAX_EXPORT_DIMENSION = 4096;
export const MAX_EXPORT_PIXELS = 16_000_000;

export function fitsRaster(width: number, height: number, maxSide: number, maxPixels: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0 && width <= maxSide && height <= maxSide && width * height <= maxPixels;
}

export function getPreviewScale(width: number, height: number): number {
  // Each preview layer allocates a scene surface at the device DPR and a hit
  // surface at 1x. Bound the visible canvas, not the source's working resolution.
  const dpr = Math.max(1, Konva.pixelRatio || globalThis.devicePixelRatio || 1);
  return Math.min(4096 / Math.max(width, height), Math.sqrt(8_000_000 / (width * height))) / dpr;
}

export function getRedactionCacheRatio(width: number, height: number): number {
  // A selection may extend outside the output or be magnified by a small crop.
  return Math.min(1, 4096 / Math.max(width, height), Math.sqrt(2_000_000 / (width * height)));
}
