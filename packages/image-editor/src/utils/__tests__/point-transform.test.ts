import { describe, expect, it } from 'vitest';
import { applyPointTransform } from '../point-transform';

describe('applyPointTransform', () => {
  it('applies translation to point clouds', () => {
    expect(
      applyPointTransform(
        [10, 20, 30, 40],
        { x: 15, y: -5, scaleX: 1, scaleY: 1, rotation: 0 },
        1,
      ),
    ).toEqual([25, 15, 45, 35]);
  });

  it('applies scaling relative to the local origin', () => {
    expect(
      applyPointTransform(
        [10, 20, 30, 40],
        { x: 0, y: 0, scaleX: 2, scaleY: 0.5, rotation: 0 },
        1,
      ),
    ).toEqual([20, 10, 60, 20]);
  });

  it('applies rotation and normalizes by annotation scale', () => {
    const next = applyPointTransform(
      [10, 0],
      { x: 20, y: 40, scaleX: 1, scaleY: 1, rotation: 90 },
      2,
    );

    expect(next[0]).toBeCloseTo(10);
    expect(next[1]).toBeCloseTo(30);
  });
});
