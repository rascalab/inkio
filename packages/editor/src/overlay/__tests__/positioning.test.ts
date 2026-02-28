import { computeOverlayPosition } from '../positioning';

describe('overlay positioning', () => {
  const boundary = {
    top: 0,
    left: 0,
    right: 320,
    bottom: 240,
    width: 320,
    height: 240,
  };

  it('flips placement when preferred side overflows', () => {
    const result = computeOverlayPosition({
      anchorRect: {
        top: 4,
        left: 120,
        right: 160,
        bottom: 24,
        width: 40,
        height: 20,
      },
      floatingRect: { width: 120, height: 60 },
      placement: 'top',
      align: 'center',
      boundaryRect: boundary,
      flip: true,
      shift: true,
      padding: 8,
      offset: 8,
    });

    expect(result.placement).toBe('bottom');
    expect(result.top).toBeGreaterThanOrEqual(8);
  });

  it('clamps overlay inside viewport bounds', () => {
    const result = computeOverlayPosition({
      anchorRect: {
        top: 120,
        left: 300,
        right: 300,
        bottom: 140,
        width: 0,
        height: 20,
      },
      floatingRect: { width: 180, height: 80 },
      placement: 'bottom',
      align: 'start',
      boundaryRect: boundary,
      flip: false,
      shift: true,
      padding: 8,
      offset: 8,
    });

    expect(result.left).toBeLessThanOrEqual(boundary.right - 180 - 8);
    expect(result.left).toBeGreaterThanOrEqual(8);
    expect(result.top).toBeGreaterThanOrEqual(8);
  });

  it('supports left/right placements', () => {
    const result = computeOverlayPosition({
      anchorRect: {
        top: 100,
        left: 10,
        right: 30,
        bottom: 140,
        width: 20,
        height: 40,
      },
      floatingRect: { width: 90, height: 70 },
      placement: 'left',
      align: 'center',
      boundaryRect: boundary,
      flip: true,
      shift: true,
      padding: 8,
      offset: 6,
    });

    expect(['left', 'right']).toContain(result.placement);
    expect(result.top).toBeGreaterThanOrEqual(8);
  });
});
