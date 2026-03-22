import type { Annotation, CropRect, Transform } from '../types';
import { imageSpaceToCanvasSpace } from './geometry';
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

  // Construct transform from options
  const crop = (options.cropX !== 0 || options.cropY !== 0)
    ? {
      x: options.cropX,
      y: options.cropY,
      width: options.originalWidth,
      height: options.originalHeight,
    }
    : null;
  const transform: Transform = {
    rotation: options.rotation,
    flipX: options.flipX,
    flipY: options.flipY,
    crop,
  };

  const projected = corners.map((corner) =>
    imageSpaceToCanvasSpace(
      corner.x,
      corner.y,
      options.displayWidth,
      options.displayHeight,
      options.originalWidth,
      options.originalHeight,
      transform,
    ),
  );

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
      return rotateRectCorners(
        annotation.x,
        annotation.y,
        annotation.width,
        annotation.height,
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
  for (let index = 0; index < points.length; index += 2) {
    xs.push(points[index]);
    ys.push(points[index + 1]);
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
