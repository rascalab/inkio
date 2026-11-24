import type { CropRect } from '../types';
import { isQuarterTurn, transformRect } from '../utils/geometry';
import { clampNumber } from '../utils/math';
import { getPreviewScale } from '../utils/raster-limits';

const CROP_ZOOM_MAX = 6;

export interface CropViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CropLayout {
  image: HTMLImageElement | null;
  imageWidth: number;
  imageHeight: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  stageWidth: number;
  stageHeight: number;
}

export interface CropGeometry {
  layout: CropLayout;
  boundsWidth: number;
  boundsHeight: number;
  frame: CropRect;
  fitScale: number;
  maxZoom: number;
}

export interface CropPlacement {
  geometry: CropGeometry;
  viewport: CropViewport;
  crop: CropRect;
}

/** Reproject a source crop into the centered aperture of the current workspace. */
export function planCropPlacement(layout: CropLayout, crop: CropRect): CropPlacement | null {
  const { imageWidth, imageHeight, rotation, flipX, flipY, stageWidth, stageHeight } = layout;
  if (stageWidth <= 0 || stageHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) return null;

  const target = transformRect(crop, imageWidth, imageHeight, rotation, flipX, flipY);
  if (target.width <= 0 || target.height <= 0) return null;
  const quarterTurn = isQuarterTurn(rotation);
  const boundsWidth = quarterTurn ? imageHeight : imageWidth;
  const boundsHeight = quarterTurn ? imageWidth : imageHeight;
  const rasterScale = getPreviewScale(boundsWidth, boundsHeight);
  // The draft owns the aperture's aspect and position. On workspace resize,
  // shrink the preview rather than expanding the source crop to fit the raster cap.
  const zoom = Math.max(1, Math.min(boundsWidth / target.width, boundsHeight / target.height));
  const fitScale = Math.min(stageWidth / boundsWidth, stageHeight / boundsHeight, rasterScale / zoom);
  const maxZoom = Math.max(zoom, Math.min(CROP_ZOOM_MAX, rasterScale / fitScale));
  const scale = fitScale * zoom;
  const width = target.width * scale;
  const height = target.height * scale;
  const frame = { x: (stageWidth - width) / 2, y: (stageHeight - height) / 2, width, height };
  const geometry = { layout, boundsWidth, boundsHeight, frame, fitScale, maxZoom };

  return {
    geometry,
    viewport: clampCropViewport(geometry, {
      zoom,
      panX: frame.x - target.x * scale - (stageWidth - boundsWidth * scale) / 2,
      panY: frame.y - target.y * scale - (stageHeight - boundsHeight * scale) / 2,
    }),
    crop,
  };
}

export function clampCropViewport(geometry: CropGeometry, viewport: CropViewport): CropViewport {
  const { boundsWidth, boundsHeight, frame, fitScale, maxZoom, layout: { stageWidth, stageHeight } } = geometry;
  const zoom = clampNumber(viewport.zoom, 1, maxZoom);
  const scale = fitScale * zoom;
  const displayWidth = boundsWidth * scale;
  const displayHeight = boundsHeight * scale;
  const centeredLeft = (stageWidth - displayWidth) / 2;
  const centeredTop = (stageHeight - displayHeight) / 2;
  const minPanX = frame.x + frame.width - centeredLeft - displayWidth;
  const maxPanX = frame.x - centeredLeft;
  const minPanY = frame.y + frame.height - centeredTop - displayHeight;
  const maxPanY = frame.y - centeredTop;

  return {
    zoom,
    panX: displayWidth <= frame.width ? (minPanX + maxPanX) / 2 : clampNumber(viewport.panX, minPanX, maxPanX),
    panY: displayHeight <= frame.height ? (minPanY + maxPanY) / 2 : clampNumber(viewport.panY, minPanY, maxPanY),
  };
}

/** Project only the clamped viewport, never its elastic visual offset. */
export function projectSourceCrop(geometry: CropGeometry, viewport: CropViewport): CropRect {
  const { boundsWidth, boundsHeight, frame, fitScale } = geometry;
  const { stageWidth, stageHeight, imageWidth, imageHeight, rotation, flipX, flipY } = geometry.layout;
  const scale = fitScale * viewport.zoom;
  const left = (stageWidth - boundsWidth * scale) / 2 + viewport.panX;
  const top = (stageHeight - boundsHeight * scale) / 2 + viewport.panY;
  const width = Math.min(boundsWidth, frame.width / scale);
  const height = Math.min(boundsHeight, frame.height / scale);
  return transformRect({
    x: clampNumber((frame.x - left) / scale, 0, boundsWidth - width),
    y: clampNumber((frame.y - top) / scale, 0, boundsHeight - height),
    width,
    height,
  }, imageWidth, imageHeight, rotation, flipX, flipY, true);
}

export function areSameSourceCrop(a: CropRect, b: CropRect): boolean {
  // Ignore floating-point roundoff in the viewport round trip and the reducer's integer snap.
  const tolerance = 1e-9;
  return a === b || (
    Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance
    && Math.abs(a.width - b.width) < tolerance && Math.abs(a.height - b.height) < tolerance
  );
}

export function areSameCropViewport(a: CropViewport, b: CropViewport): boolean {
  return Math.abs(a.zoom - b.zoom) < 0.0001 && Math.abs(a.panX - b.panX) < 0.01 && Math.abs(a.panY - b.panY) < 0.01;
}
