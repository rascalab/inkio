import { computeOverlayPosition } from '../positioning';

const boundary = {
  top: 0,
  left: 0,
  right: 800,
  bottom: 600,
  width: 800,
  height: 600,
};

const anchor = {
  top: 200,
  left: 300,
  right: 400,
  bottom: 230,
  width: 100,
  height: 30,
};

const floating = { width: 160, height: 80 };

describe('computeOverlayPosition — placement', () => {
  it('places above anchor with placement: top', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'top',
      align: 'center',
      offset: 8,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(result.placement).toBe('top');
    // top = anchorRect.top - floatingRect.height - offset = 200 - 80 - 8 = 112
    expect(result.top).toBe(112);
  });

  it('places below anchor with placement: bottom', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'center',
      offset: 8,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(result.placement).toBe('bottom');
    // top = anchorRect.bottom + offset = 230 + 8 = 238
    expect(result.top).toBe(238);
  });

  it('places left of anchor with placement: left', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'left',
      align: 'center',
      offset: 8,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(result.placement).toBe('left');
    // left = anchorRect.left - floatingRect.width - offset = 300 - 160 - 8 = 132
    expect(result.left).toBe(132);
  });

  it('places right of anchor with placement: right', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'right',
      align: 'center',
      offset: 8,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(result.placement).toBe('right');
    // left = anchorRect.right + offset = 400 + 8 = 408
    expect(result.left).toBe(408);
  });

  it('flips from top to bottom when not enough space above', () => {
    const tightAnchor = {
      top: 10,   // very little space above
      left: 300,
      right: 400,
      bottom: 40,
      width: 100,
      height: 30,
    };

    const result = computeOverlayPosition({
      anchorRect: tightAnchor,
      floatingRect: { width: 160, height: 80 },
      placement: 'top',
      align: 'center',
      offset: 8,
      flip: true,
      shift: false,
      boundaryRect: boundary,
      padding: 8,
    });

    // top placement would put it at 10 - 80 - 8 = -78, overflowing top
    // bottom would put it at 40 + 8 = 48, no overflow
    expect(result.placement).toBe('bottom');
  });

  it('does not flip when flip: false', () => {
    const tightAnchor = {
      top: 10,
      left: 300,
      right: 400,
      bottom: 40,
      width: 100,
      height: 30,
    };

    const result = computeOverlayPosition({
      anchorRect: tightAnchor,
      floatingRect: { width: 160, height: 80 },
      placement: 'top',
      align: 'center',
      offset: 8,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(result.placement).toBe('top');
  });

  it('shifts to stay within boundary', () => {
    // anchor near right edge, floating would overflow right
    const rightAnchor = {
      top: 200,
      left: 720,
      right: 790,
      bottom: 230,
      width: 70,
      height: 30,
    };

    const result = computeOverlayPosition({
      anchorRect: rightAnchor,
      floatingRect: { width: 200, height: 60 },
      placement: 'bottom',
      align: 'start',
      offset: 8,
      flip: false,
      shift: true,
      boundaryRect: boundary,
      padding: 8,
    });

    // right edge of floating must not exceed boundary.right - padding = 792
    expect(result.left + 200).toBeLessThanOrEqual(boundary.right - 8);
    expect(result.left).toBeGreaterThanOrEqual(boundary.left + 8);
  });

  it('handles zero-size anchor gracefully', () => {
    const zeroAnchor = {
      top: 200,
      left: 300,
      right: 300,
      bottom: 200,
      width: 0,
      height: 0,
    };

    const result = computeOverlayPosition({
      anchorRect: zeroAnchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'center',
      offset: 8,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(typeof result.top).toBe('number');
    expect(typeof result.left).toBe('number');
    expect(result.placement).toBe('bottom');
  });

  it('applies offset correctly', () => {
    const result0 = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'center',
      offset: 0,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    const result16 = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'center',
      offset: 16,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    // With more offset, top should be larger
    expect(result16.top - result0.top).toBe(16);
  });

  it('uses viewport as boundary when boundaryRect is not provided', () => {
    // jsdom sets window.innerWidth/Height to 0 by default but still returns a result
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'center',
      offset: 8,
    });

    expect(typeof result.top).toBe('number');
    expect(typeof result.left).toBe('number');
  });

  it('center-aligns floating element horizontally for top/bottom placements', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,     // left: 300, right: 400, centerX: 350
      floatingRect: floating, // width: 160
      placement: 'bottom',
      align: 'center',
      offset: 0,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    // left = anchorCenterX - floatingWidth / 2 = 350 - 80 = 270
    expect(result.left).toBe(270);
  });

  it('start-aligns floating element for top/bottom placements', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'start',
      offset: 0,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    expect(result.left).toBe(anchor.left);
  });

  it('end-aligns floating element for top/bottom placements', () => {
    const result = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect: floating,
      placement: 'bottom',
      align: 'end',
      offset: 0,
      flip: false,
      shift: false,
      boundaryRect: boundary,
    });

    // left = anchorRect.right - floatingRect.width = 400 - 160 = 240
    expect(result.left).toBe(240);
  });
});
