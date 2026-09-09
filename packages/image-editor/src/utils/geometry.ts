import type { Transform, OutputSize, CropRect } from '../types';

function safeDiv(numerator: number, denominator: number, fallback: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

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
    // Guard zero originals (image not loaded yet): 0/0 would poison layout with NaN.
    const scaleX = safeDiv(w, originalWidth, 1);
    const scaleY = safeDiv(h, originalHeight, 1);
    w = transform.crop.width * scaleX;
    h = transform.crop.height * scaleY;
  }

  if (isQuarterTurn(transform.rotation)) {
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
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    displayWidth, displayHeight, transform.rotation,
  );

  // 1. Center-relative in stage space
  let lx = cx - displayWidth / 2;
  let ly = cy - displayHeight / 2;

  // 2. Inverse rotation
  const rad = (-transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = lx * cos - ly * sin;
  const ry = lx * sin + ly * cos;

  // 3. Inverse flip
  lx = rx * (transform.flipX ? -1 : 1);
  ly = ry * (transform.flipY ? -1 : 1);

  // 4. Un-center (base display space)
  lx += baseW / 2;
  ly += baseH / 2;

  // 5. Scale to image/crop space + crop offset
  const crop = transform.crop ?? { x: 0, y: 0, width: originalWidth, height: originalHeight };
  return {
    x: safeDiv(lx, baseW, 0) * crop.width + crop.x,
    y: safeDiv(ly, baseH, 0) * crop.height + crop.y,
  };
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
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    displayWidth, displayHeight, transform.rotation,
  );

  // 1. Scale from image/crop space to base display space
  const crop = transform.crop ?? { x: 0, y: 0, width: originalWidth, height: originalHeight };
  let lx = safeDiv(ix - crop.x, crop.width, 0) * baseW;
  let ly = safeDiv(iy - crop.y, crop.height, 0) * baseH;

  // 2. Center-relative (base display space)
  lx -= baseW / 2;
  ly -= baseH / 2;

  // 3. Forward flip
  lx = lx * (transform.flipX ? -1 : 1);
  ly = ly * (transform.flipY ? -1 : 1);

  // 4. Forward rotation
  const rad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = lx * cos - ly * sin;
  const ry = lx * sin + ly * cos;

  // 5. Un-center in stage space
  return {
    x: rx + displayWidth / 2,
    y: ry + displayHeight / 2,
  };
}

/**
 * Transform a point through rotation and flip around the center of a rect.
 * Forward: flip then rotate. Inverse: un-rotate then un-flip.
 */
export function transformPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  flipX: boolean,
  flipY: boolean,
  inverse = false,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  let lx = x - cx;
  let ly = y - cy;

  if (inverse) {
    // Un-rotate then un-flip
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    lx = rx * (flipX ? -1 : 1);
    ly = ry * (flipY ? -1 : 1);
  } else {
    // Flip then rotate
    lx = lx * (flipX ? -1 : 1);
    ly = ly * (flipY ? -1 : 1);
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    lx = rx;
    ly = ry;
  }

  // For quarter turns, the output center shifts
  const isQT = isQuarterTurn(rotation);
  const outCx = inverse ? cx : isQT ? cy : cx;
  const outCy = inverse ? cy : isQT ? cx : cy;
  return { x: lx + outCx, y: ly + outCy };
}

/**
 * Transform a rect through rotation/flip by projecting all 4 corners
 * and taking the bounding box.
 */
export function transformRect(
  rect: CropRect,
  originalWidth: number,
  originalHeight: number,
  rotation: number,
  flipX: boolean,
  flipY: boolean,
  inverse = false,
): CropRect {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];

  const projected = corners.map((c) =>
    transformPoint(c.x, c.y, originalWidth, originalHeight, rotation, flipX, flipY, inverse),
  );

  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
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
