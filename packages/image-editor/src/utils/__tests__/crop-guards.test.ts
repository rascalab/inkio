import { describe, expect, it } from 'vitest';
import { getDefaultCropRect } from '../crop';

describe('getDefaultCropRect guards', () => {
  it('returns a zero rect for non-finite dimensions', () => {
    expect(getDefaultCropRect(Number.NaN, 100, null)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(getDefaultCropRect(100, Number.POSITIVE_INFINITY, 1)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('falls back to the full frame for non-finite or non-positive aspect ratios', () => {
    expect(getDefaultCropRect(200, 100, Number.NaN)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(getDefaultCropRect(200, 100, Number.POSITIVE_INFINITY)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(getDefaultCropRect(200, 100, 0)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(getDefaultCropRect(200, 100, -1)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('still centers a valid aspect ratio', () => {
    expect(getDefaultCropRect(200, 100, 1)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });
});
