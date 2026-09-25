import { describe, expect, it } from 'vitest';
import {
  canvasSpaceToImageSpace,
  getBaseDisplayDimensions,
  getTransformedDimensions,
  imageSpaceToCanvasSpace,
  transformPoint,
  transformRect,
} from '../geometry';
import type { Transform } from '../../types';

describe('geometry helpers', () => {
  it('swaps base display dimensions for quarter turns', () => {
    expect(getBaseDisplayDimensions(180, 320, 90)).toEqual({ width: 320, height: 180 });
    expect(getBaseDisplayDimensions(180, 320, 270)).toEqual({ width: 320, height: 180 });
    expect(getBaseDisplayDimensions(180, 320, 180)).toEqual({ width: 180, height: 320 });
  });

  it('round-trips rotated points through canvas and image space', () => {
    const transform: Transform = {
      rotation: 90,
      flipX: false,
      flipY: false,
      crop: null,
    };
    const displayWidth = 50;
    const displayHeight = 100;
    const originalWidth = 100;
    const originalHeight = 50;

    const canvasPoint = imageSpaceToCanvasSpace(
      20,
      15,
      displayWidth,
      displayHeight,
      originalWidth,
      originalHeight,
      transform,
    );
    const imagePoint = canvasSpaceToImageSpace(
      canvasPoint.x,
      canvasPoint.y,
      displayWidth,
      displayHeight,
      originalWidth,
      originalHeight,
      transform,
    );

    expect(imagePoint.x).toBeCloseTo(20, 4);
    expect(imagePoint.y).toBeCloseTo(15, 4);
  });

  it('round-trips rotated cropped points through canvas and image space', () => {
    const transform: Transform = {
      rotation: 270,
      flipX: true,
      flipY: false,
      crop: {
        x: 20,
        y: 10,
        width: 60,
        height: 30,
      },
    };
    const displayWidth = 90;
    const displayHeight = 180;
    const originalWidth = 100;
    const originalHeight = 50;

    const canvasPoint = imageSpaceToCanvasSpace(
      42,
      28,
      displayWidth,
      displayHeight,
      originalWidth,
      originalHeight,
      transform,
    );
    const imagePoint = canvasSpaceToImageSpace(
      canvasPoint.x,
      canvasPoint.y,
      displayWidth,
      displayHeight,
      originalWidth,
      originalHeight,
      transform,
    );

    expect(imagePoint.x).toBeCloseTo(42, 4);
    expect(imagePoint.y).toBeCloseTo(28, 4);
  });

  it('maps center of display to center of crop region via canvasSpaceToImageSpace', () => {
    const transform: Transform = { rotation: 0, flipX: false, flipY: false, crop: { x: 100, y: 50, width: 400, height: 300 } };
    const result = canvasSpaceToImageSpace(50, 50, 100, 100, 800, 600, transform);
    expect(result.x).toBeCloseTo(300);
    expect(result.y).toBeCloseTo(200);
  });

  it('accounts for 90° rotation in canvasSpaceToImageSpace', () => {
    const transform: Transform = { rotation: 90, flipX: false, flipY: false, crop: null };
    const result = canvasSpaceToImageSpace(300, 400, 600, 800, 800, 600, transform);
    expect(result.x).toBeCloseTo(400);
    expect(result.y).toBeCloseTo(300);
  });

  it('never returns NaN for zero dimensions', () => {
    const transform: Transform = { rotation: 0, flipX: false, flipY: false, crop: null };
    const dims = getTransformedDimensions(0, 0, transform, null);
    expect(Number.isFinite(dims.width)).toBe(true);
    expect(Number.isFinite(dims.height)).toBe(true);

    const toImage = canvasSpaceToImageSpace(10, 10, 0, 0, 0, 0, transform);
    expect(Number.isFinite(toImage.x)).toBe(true);
    expect(Number.isFinite(toImage.y)).toBe(true);

    const toCanvas = imageSpaceToCanvasSpace(10, 10, 0, 0, 0, 0, transform);
    expect(Number.isFinite(toCanvas.x)).toBe(true);
    expect(Number.isFinite(toCanvas.y)).toBe(true);
  });

  it('inverts quarter turns around the swapped center for non-square rects', () => {
    // Forward maps 100x50 around (50,25) into 50x100 space around (25,50);
    // the inverse must start from the swapped center, not (50,25).
    const forward = transformPoint(70, 30, 100, 50, 90, false, false, false);
    const back = transformPoint(forward.x, forward.y, 100, 50, 90, false, false, true);
    expect(back.x).toBeCloseTo(70, 4);
    expect(back.y).toBeCloseTo(30, 4);
  });

  it('inverts quarter-turn rects without drift', () => {
    const rect = { x: 10, y: 5, width: 60, height: 20 };
    const forward = transformRect(rect, 100, 50, 270, false, false, false);
    const back = transformRect(forward, 100, 50, 270, false, false, true);
    expect(back.x).toBeCloseTo(rect.x, 4);
    expect(back.y).toBeCloseTo(rect.y, 4);
    expect(back.width).toBeCloseTo(rect.width, 4);
    expect(back.height).toBeCloseTo(rect.height, 4);
  });

  it('treats non-normalized quarter turns consistently', () => {
    const base: Transform = { rotation: 90, flipX: false, flipY: false, crop: null };
    const wide: Transform = { rotation: 450, flipX: false, flipY: false, crop: null };
    expect(getTransformedDimensions(100, 50, wide, null)).toEqual(
      getTransformedDimensions(100, 50, base, null),
    );
  });
});
