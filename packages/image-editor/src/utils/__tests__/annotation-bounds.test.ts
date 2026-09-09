import { describe, expect, it } from 'vitest';
import { getAnnotationDisplayBounds } from '../annotation-bounds';
import type { Annotation } from '../../types';

const baseOptions = {
  annotationScale: 1,
  cropX: 0,
  cropY: 0,
  displayWidth: 800,
  displayHeight: 600,
  originalWidth: 800,
  originalHeight: 600,
  rotation: 0,
  flipX: false,
  flipY: false,
};

describe('getAnnotationDisplayBounds', () => {
  it('ignores a trailing lone coordinate instead of producing NaN', () => {
    const annotation = {
      id: 'a',
      type: 'line',
      points: [10, 20, 30],
      stroke: '#000',
      strokeWidth: 2,
    } as unknown as Annotation;

    const bounds = getAnnotationDisplayBounds(annotation, baseOptions);
    expect(Number.isFinite(bounds.x)).toBe(true);
    expect(Number.isFinite(bounds.y)).toBe(true);
    expect(Number.isFinite(bounds.width)).toBe(true);
    expect(Number.isFinite(bounds.height)).toBe(true);
  });

  it('returns a finite zero rect for empty points', () => {
    const annotation = {
      id: 'b',
      type: 'freedraw',
      points: [],
      stroke: '#000',
      strokeWidth: 2,
      opacity: 1,
    } as unknown as Annotation;

    const bounds = getAnnotationDisplayBounds(annotation, baseOptions);
    expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
