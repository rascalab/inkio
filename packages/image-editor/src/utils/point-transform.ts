export interface PointTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export function applyPointTransform(
  points: number[],
  transform: PointTransform,
  annotationScale: number,
): number[] {
  // Guard degenerate inputs: odd-length point arrays have no valid (x, y)
  // pairing for the trailing value (points[i+1] would be undefined → NaN),
  // and a non-finite/zero scale cannot normalize. Return input untouched.
  if (
    points.length < 2 ||
    points.length % 2 !== 0 ||
    !Number.isFinite(annotationScale) ||
    annotationScale === 0
  ) {
    return points;
  }

  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const nextPoints: number[] = [];

  for (let index = 0; index < points.length; index += 2) {
    const localX = points[index] * annotationScale * transform.scaleX;
    const localY = points[index + 1] * annotationScale * transform.scaleY;
    const rotatedX = (localX * cos) - (localY * sin);
    const rotatedY = (localX * sin) + (localY * cos);

    nextPoints.push((rotatedX + transform.x) / annotationScale);
    nextPoints.push((rotatedY + transform.y) / annotationScale);
  }

  return nextPoints;
}
