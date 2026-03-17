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
  if (points.length < 2 || annotationScale === 0) {
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
