import { describe, expect, it } from 'vitest';
import { isDisplayBoundsOutsideViewport } from '../annotation-bounds';

describe('isDisplayBoundsOutsideViewport', () => {
  it('keeps onscreen bounds', () => {
    expect(isDisplayBoundsOutsideViewport({ x: 10, y: 10, width: 100, height: 80 }, 800, 600)).toBe(false);
  });

  it('culls fully offscreen bounds on each side', () => {
    expect(isDisplayBoundsOutsideViewport({ x: -200, y: 10, width: 50, height: 50 }, 800, 600)).toBe(true);
    expect(isDisplayBoundsOutsideViewport({ x: 900, y: 10, width: 50, height: 50 }, 800, 600)).toBe(true);
    expect(isDisplayBoundsOutsideViewport({ x: 10, y: -200, width: 50, height: 50 }, 800, 600)).toBe(true);
    expect(isDisplayBoundsOutsideViewport({ x: 10, y: 700, width: 50, height: 50 }, 800, 600)).toBe(true);
  });

  it('keeps partially visible bounds (margin included)', () => {
    expect(isDisplayBoundsOutsideViewport({ x: -100, y: 10, width: 50, height: 50 }, 800, 600, 64)).toBe(false);
    expect(isDisplayBoundsOutsideViewport({ x: -100, y: 10, width: 50, height: 50 }, 800, 600, 0)).toBe(true);
  });
});
