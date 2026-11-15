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
  const w = outputSize?.width ?? transform.crop?.width ?? originalWidth;
  const h = outputSize?.height ?? transform.crop?.height ?? originalHeight;

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

/**
 * Per-axis display pixels per original-image unit. Shapes use the X scale
 * locally; their shared parent supplies the remaining Y stretch.
 */
export function getAnnotationScale(
  transform: Transform,
  originalWidth: number,
  originalHeight: number,
  displayWidth: number,
  displayHeight: number,
): { x: number; y: number } {
  const srcW = transform.crop?.width ?? originalWidth;
  const srcH = transform.crop?.height ?? originalHeight;
  const { width: baseDisplayWidth, height: baseDisplayHeight } = getBaseDisplayDimensions(
    displayWidth, displayHeight, transform.rotation ?? 0,
  );
  return {
    x: srcW > 0 && baseDisplayWidth > 0 ? baseDisplayWidth / srcW : 1,
    y: srcH > 0 && baseDisplayHeight > 0 ? baseDisplayHeight / srcH : 1,
  };
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
  const rotated = rotateVector(lx, ly, -transform.rotation);

  // 3. Inverse flip
  lx = rotated.x * (transform.flipX ? -1 : 1);
  ly = rotated.y * (transform.flipY ? -1 : 1);

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
  const rotated = rotateVector(lx, ly, transform.rotation);

  // 5. Un-center in stage space
  return {
    x: rotated.x + displayWidth / 2,
    y: rotated.y + displayHeight / 2,
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
  // Quarter turns swap the output space (w x h -> h x w): the forward path
  // leaves from the original center and lands on the swapped one, and the
  // inverse path does the reverse. Centering both ways on the original
  // un-centers non-square rects by (w-h)/2.
  const isQT = isQuarterTurn(rotation);
  const swappedCx = isQT ? cy : cx;
  const swappedCy = isQT ? cx : cy;
  let lx = x - (inverse ? swappedCx : cx);
  let ly = y - (inverse ? swappedCy : cy);

  if (inverse) {
    // Un-rotate then un-flip
    const rotated = rotateVector(lx, ly, -rotation);
    lx = rotated.x * (flipX ? -1 : 1);
    ly = rotated.y * (flipY ? -1 : 1);
  } else {
    // Flip then rotate
    lx = lx * (flipX ? -1 : 1);
    ly = ly * (flipY ? -1 : 1);
    const rotated = rotateVector(lx, ly, rotation);
    lx = rotated.x;
    ly = rotated.y;
  }

  return { x: lx + (inverse ? cx : swappedCx), y: ly + (inverse ? cy : swappedCy) };
}

function rotateVector(x: number, y: number, rotation: number): { x: number; y: number } {
  switch (((rotation % 360) + 360) % 360) {
    case 0: return { x, y };
    case 90: return { x: -y, y: x };
    case 180: return { x: -x, y: -y };
    case 270: return { x: y, y: -x };
    default: {
      const radians = rotation * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return { x: x * cos - y * sin, y: x * sin + y * cos };
    }
  }
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
