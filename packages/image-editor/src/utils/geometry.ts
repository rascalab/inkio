import type { Transform, OutputSize, CropRect } from '../types';

/** Compute the canvas display dimensions after applying transform */
export function getTransformedDimensions(
  originalWidth: number,
  originalHeight: number,
  transform: Transform,
  outputSize: OutputSize | null,
): { width: number; height: number } {
  let w = outputSize ? outputSize.width : originalWidth;
  let h = outputSize ? outputSize.height : originalHeight;

  if (transform.crop) {
    const scaleX = w / originalWidth;
    const scaleY = h / originalHeight;
    w = transform.crop.width * scaleX;
    h = transform.crop.height * scaleY;
  }

  const isRotated90 = transform.rotation === 90 || transform.rotation === 270;
  if (isRotated90) {
    return { width: h, height: w };
  }
  return { width: w, height: h };
}

/** Whether the rotation is a quarter turn (90° or 270°) */
export function isQuarterTurn(rotation: number): boolean {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 270;
}

/**
 * Un-swap dimensions for quarter turns.
 * getTransformedDimensions returns swapped w/h for 90°/270°.
 * This returns the base (un-rotated) display dimensions so that
 * Konva can apply the rotation prop without double-swapping.
 */
export function getBaseDisplayDimensions(
  displayWidth: number,
  displayHeight: number,
  rotation: number,
): { width: number; height: number } {
  return isQuarterTurn(rotation)
    ? { width: displayHeight, height: displayWidth }
    : { width: displayWidth, height: displayHeight };
}

/** Map a point from canvas display space to original image space */
export function canvasSpaceToImageSpace(
  cx: number,
  cy: number,
  displayWidth: number,
  displayHeight: number,
  originalWidth: number,
  originalHeight: number,
  transform: Transform,
): { x: number; y: number } {
  const scaleX = originalWidth / displayWidth;
  const scaleY = originalHeight / displayHeight;

  let x = cx * scaleX;
  let y = cy * scaleY;

  // Account for rotation (inverse)
  const cx2 = originalWidth / 2;
  const cy2 = originalHeight / 2;
  const rad = (-transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = (x - cx2) * cos - (y - cy2) * sin + cx2;
  const ry = (x - cx2) * sin + (y - cy2) * cos + cy2;
  x = rx;
  y = ry;

  // Account for flip (inverse)
  if (transform.flipX) x = originalWidth - x;
  if (transform.flipY) y = originalHeight - y;

  return { x, y };
}

/** Map a point from original image space to canvas display space */
export function imageSpaceToCanvasSpace(
  ix: number,
  iy: number,
  displayWidth: number,
  displayHeight: number,
  originalWidth: number,
  originalHeight: number,
  transform: Transform,
): { x: number; y: number } {
  let x = ix;
  let y = iy;

  if (transform.flipX) x = originalWidth - x;
  if (transform.flipY) y = originalHeight - y;

  const cx2 = originalWidth / 2;
  const cy2 = originalHeight / 2;
  const rad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = (x - cx2) * cos - (y - cy2) * sin + cx2;
  const ry = (x - cx2) * sin + (y - cy2) * cos + cy2;

  const scaleX = displayWidth / originalWidth;
  const scaleY = displayHeight / originalHeight;
  return { x: rx * scaleX, y: ry * scaleY };
}

/** Clamp a point to stay within a bounding rect */
export function clampToRect(
  x: number,
  y: number,
  rect: CropRect,
): { x: number; y: number } {
  return {
    x: Math.max(rect.x, Math.min(rect.x + rect.width, x)),
    y: Math.max(rect.y, Math.min(rect.y + rect.height, y)),
  };
}

/** Normalize a rect so width/height are positive */
export function normalizeRect(
  x: number,
  y: number,
  width: number,
  height: number,
): CropRect {
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}
