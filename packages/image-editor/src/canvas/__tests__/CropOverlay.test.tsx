// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CropOverlay } from '../CropOverlay';

afterEach(() => {
  cleanup();
});

describe('CropOverlay degenerate frames', () => {
  it('never emits negative CSS sizes for a mid-drag frame', () => {
    const { container } = render(
      <CropOverlay
        containerWidth={400}
        containerHeight={300}
        frame={{ x: -10, y: -20, width: -5, height: 900 }}
      />,
    );

    const px = (value: string): number => Number.parseFloat(value);
    const boxes = container.querySelectorAll<HTMLElement>('.inkio-ie-crop-mask, .inkio-ie-crop-frame');
    expect(boxes.length).toBeGreaterThan(0);
    boxes.forEach((box) => {
      expect(px(box.style.width)).toBeGreaterThanOrEqual(0);
      expect(px(box.style.height)).toBeGreaterThanOrEqual(0);
    });
  });
});
