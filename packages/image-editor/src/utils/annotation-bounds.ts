import type { Annotation, CropRect } from '../types';
import { getBaseDisplayDimensions } from './geometry';
import { getTextAnnotationHeight, getTextAnnotationWidth } from './text-metrics';

interface Point {
  x: number;
  y: number;
}

export interface AnnotationDisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Viewport-culling predicate for DesignLayer: true when the bounds are fully
 * outside the stage (plus margin), meaning the node can be hidden with
 * `visible={false}` while staying mounted for selection/Transformer.
 */
export function isDisplayBoundsOutsideViewport(
  bounds: AnnotationDisplayBounds,
  viewportWidth: number,
  viewportHeight: number,
  margin = 64,
): boolean {
  return (
    bounds.x + bounds.width < -margin
    || bounds.x > viewportWidth + margin
    || bounds.y + bounds.height < -margin
    || bounds.y > viewportHeight + margin
  );
}

interface DisplayProjectionOptions {
  annotationScale: number;
  cropX: number;
  cropY: number;
  displayWidth: number;
  displayHeight: number;
  originalWidth: number;
  originalHeight: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export function getAnnotationDisplayBounds(
  annotation: Annotation,
  options: DisplayProjectionOptions,
): AnnotationDisplayBounds {
  const corners = getAnnotationCorners(annotation);

  // Mirror the DesignLayer group chain exactly: annotations render at
  // image-space coords times the uniform annotationScale (NOT a per-axis
  // display/original stretch), shifted by the crop origin, then centered on
  // the unrotated base, flipped, rotated, and centered on the stage.
  // Routing through imageSpaceToCanvasSpace instead divided by the full
  // original dims, drifting bounds whenever a crop is active.
  const scale =
    Number.isFinite(options.annotationScale) && options.annotationScale > 0
      ? options.annotationScale
      : 1;
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    options.displayWidth,
    options.displayHeight,
    options.rotation,
  );
  const rad = (options.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const projected = corners.map((corner) => {
    let lx = (corner.x - options.cropX) * scale - baseW / 2;
    let ly = (corner.y - options.cropY) * scale - baseH / 2;
    lx *= options.flipX ? -1 : 1;
    ly *= options.flipY ? -1 : 1;
    return {
      x: lx * cos - ly * sin + options.displayWidth / 2,
      y: lx * sin + ly * cos + options.displayHeight / 2,
    };
  });

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getAnnotationCorners(annotation: Annotation): Point[] {
  switch (annotation.type) {
    case 'rect':
    case 'redact':
      return rotateRectCorners(
        annotation.x,
        annotation.y,
        annotation.width,
        annotation.height,
        annotation.rotation,
        { x: annotation.x, y: annotation.y },
      );
    case 'sticker':
      return rotateRectCorners(
        annotation.x,
        annotation.y,
        annotation.size,
        annotation.size,
        annotation.rotation,
        { x: annotation.x, y: annotation.y },
      );
    case 'ellipse':
      return rotateRectCorners(
        annotation.x - annotation.radiusX,
        annotation.y - annotation.radiusY,
        annotation.radiusX * 2,
        annotation.radiusY * 2,
        annotation.rotation,
        { x: annotation.x, y: annotation.y },
      );
    case 'text':
      return rotateRectCorners(
        annotation.x,
        annotation.y,
        getTextAnnotationWidth(annotation),
        getTextAnnotationHeight(annotation),
        annotation.rotation,
        { x: annotation.x, y: annotation.y },
      );
    case 'arrow':
    case 'line':
      return getPointCloudCorners(annotation.points, annotation.strokeWidth / 2);
    case 'freedraw':
      return getPointCloudCorners(annotation.points, annotation.strokeWidth / 2);
    default:
      return getCropCorners({ x: 0, y: 0, width: 0, height: 0 });
  }
}

function rotateRectCorners(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  origin: Point,
): Point[] {
  return getCropCorners({ x, y, width, height }).map((point) => rotatePoint(point, origin, rotation));
}

function getPointCloudCorners(points: number[], padding: number): Point[] {
  if (points.length < 2) {
    return getCropCorners({ x: 0, y: 0, width: 0, height: 0 });
  }

  const xs: number[] = [];
  const ys: number[] = [];
  // Only consume complete x/y pairs: a trailing lone value would push
  // `undefined` and poison Math.min/max with NaN (overlay at NaNpx).
  for (let index = 0; index + 1 < points.length; index += 2) {
    xs.push(points[index]);
    ys.push(points[index + 1]);
  }

  if (xs.length === 0) {
    return getCropCorners({ x: 0, y: 0, width: 0, height: 0 });
  }

  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  return getCropCorners({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  });
}

function getCropCorners(rect: CropRect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function rotatePoint(point: Point, origin: Point, rotation: number): Point {
  if (rotation === 0) {
    return point;
  }

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const translatedX = point.x - origin.x;
  const translatedY = point.y - origin.y;

  return {
    x: translatedX * cos - translatedY * sin + origin.x,
    y: translatedX * sin + translatedY * cos + origin.y,
  };
}
