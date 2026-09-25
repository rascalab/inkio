// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeOverlayPosition } from '../positioning';

/**
 * computeOverlayPosition is imported by SSR/static-render paths: without an
 * explicit boundaryRect it must fall back deterministically instead of
 * throwing on `window` (node environment has none).
 */
describe('computeOverlayPosition without a DOM', () => {
  const anchor = { top: 100, left: 100, right: 200, bottom: 120, width: 100, height: 20 };

  it('positions against a zero boundary instead of throwing', () => {
    expect(typeof window).toBe('undefined');
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: { width: 160, height: 200 },
    });

    expect(Number.isFinite(result.top)).toBe(true);
    expect(Number.isFinite(result.left)).toBe(true);
    expect(['top', 'bottom', 'left', 'right']).toContain(result.placement);
  });
});
