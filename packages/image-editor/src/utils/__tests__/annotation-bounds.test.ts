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
  it('keeps selection bounds on the image after unequal-axis resizing', () => {
    const annotation: Annotation = {
      id: 'resized', type: 'rect', x: 50, y: 50, width: 10, height: 10,
      fill: '#ef4444', stroke: 'transparent', strokeWidth: 0, rotation: 0,
    };
    expect(getAnnotationDisplayBounds(annotation, {
      ...baseOptions,
      originalWidth: 100, originalHeight: 100,
      displayWidth: 200, displayHeight: 100,
      annotationScale: 2, annotationScaleY: 1,
    })).toEqual({ x: 100, y: 50, width: 20, height: 10 });
  });

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

  it('scales by annotationScale and offsets by the crop origin', () => {
    const annotation = {
      id: 'c',
      type: 'rect',
      x: 100,
      y: 50,
      width: 40,
      height: 30,
      rotation: 0,
    } as unknown as Annotation;

    const bounds = getAnnotationDisplayBounds(annotation, {
      ...baseOptions,
      annotationScale: 2,
      cropX: 100,
      cropY: 50,
    });
    // Crop-origin corner lands on the stage origin; size follows the
    // uniform annotation scale, not a full-dims stretch.
    expect(bounds.x).toBeCloseTo(0, 4);
    expect(bounds.y).toBeCloseTo(0, 4);
    expect(bounds.width).toBeCloseTo(80, 4);
    expect(bounds.height).toBeCloseTo(60, 4);
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
