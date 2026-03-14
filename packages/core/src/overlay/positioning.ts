export interface RectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export type OverlayPlacement = 'top' | 'bottom' | 'left' | 'right';
export type OverlayAlignment = 'start' | 'center' | 'end';

export interface OverlayPositionOptions {
  anchorRect: RectLike;
  floatingRect: Pick<RectLike, 'width' | 'height'>;
  placement?: OverlayPlacement;
  align?: OverlayAlignment;
  offset?: number;
  padding?: number;
  flip?: boolean;
  shift?: boolean;
  boundaryRect?: RectLike;
}

export interface OverlayPositionResult {
  top: number;
  left: number;
  placement: OverlayPlacement;
}

const DEFAULT_PADDING = 8;
const DEFAULT_OFFSET = 8;

function toViewportRect(): RectLike {
  return {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function getOppositePlacement(placement: OverlayPlacement): OverlayPlacement {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return placement;
  }
}

function computeCoordinates(
  placement: OverlayPlacement,
  align: OverlayAlignment,
  anchorRect: RectLike,
  floatingRect: Pick<RectLike, 'width' | 'height'>,
  offset: number,
): { top: number; left: number } {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;

  switch (placement) {
    case 'top': {
      const top = anchorRect.top - floatingRect.height - offset;
      const left =
        align === 'start'
          ? anchorRect.left
          : align === 'end'
            ? anchorRect.right - floatingRect.width
            : anchorCenterX - floatingRect.width / 2;
      return { top, left };
    }
    case 'bottom': {
      const top = anchorRect.bottom + offset;
      const left =
        align === 'start'
          ? anchorRect.left
          : align === 'end'
            ? anchorRect.right - floatingRect.width
            : anchorCenterX - floatingRect.width / 2;
      return { top, left };
    }
    case 'left': {
      const left = anchorRect.left - floatingRect.width - offset;
      const top =
        align === 'start'
          ? anchorRect.top
          : align === 'end'
            ? anchorRect.bottom - floatingRect.height
            : anchorCenterY - floatingRect.height / 2;
      return { top, left };
    }
    case 'right': {
      const left = anchorRect.right + offset;
      const top =
        align === 'start'
          ? anchorRect.top
          : align === 'end'
            ? anchorRect.bottom - floatingRect.height
            : anchorCenterY - floatingRect.height / 2;
      return { top, left };
    }
    default:
      return { top: anchorRect.bottom + offset, left: anchorRect.left };
  }
}

function overflowScore(
  top: number,
  left: number,
  floatingRect: Pick<RectLike, 'width' | 'height'>,
  boundaryRect: RectLike,
  padding: number,
): number {
  const right = left + floatingRect.width;
  const bottom = top + floatingRect.height;

  const overflowTop = Math.max(0, boundaryRect.top + padding - top);
  const overflowLeft = Math.max(0, boundaryRect.left + padding - left);
  const overflowRight = Math.max(0, right - (boundaryRect.right - padding));
  const overflowBottom = Math.max(0, bottom - (boundaryRect.bottom - padding));

  return overflowTop + overflowLeft + overflowRight + overflowBottom;
}

export function computeOverlayPosition(options: OverlayPositionOptions): OverlayPositionResult {
  const {
    anchorRect,
    floatingRect,
    placement = 'bottom',
    align = 'center',
    offset = DEFAULT_OFFSET,
    padding = DEFAULT_PADDING,
    flip = true,
    shift = true,
    boundaryRect = toViewportRect(),
  } = options;

  let resolvedPlacement = placement;
  let { top, left } = computeCoordinates(resolvedPlacement, align, anchorRect, floatingRect, offset);

  if (flip) {
    const opposite = getOppositePlacement(placement);
    const oppositeCoords = computeCoordinates(opposite, align, anchorRect, floatingRect, offset);

    const currentOverflow = overflowScore(top, left, floatingRect, boundaryRect, padding);
    const oppositeOverflow = overflowScore(
      oppositeCoords.top,
      oppositeCoords.left,
      floatingRect,
      boundaryRect,
      padding,
    );

    if (oppositeOverflow < currentOverflow) {
      resolvedPlacement = opposite;
      top = oppositeCoords.top;
      left = oppositeCoords.left;
    }
  }

  if (shift) {
    top = clamp(
      top,
      boundaryRect.top + padding,
      boundaryRect.bottom - floatingRect.height - padding,
    );

    left = clamp(
      left,
      boundaryRect.left + padding,
      boundaryRect.right - floatingRect.width - padding,
    );
  }

  return {
    top,
    left,
    placement: resolvedPlacement,
  };
}

function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function isScrollable(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const overflow = `${style.overflow}${style.overflowX}${style.overflowY}`;
  return /(auto|scroll|overlay)/.test(overflow);
}

function getScrollParents(element: Element | null): Array<Element | Window> {
  const parents: Array<Element | Window> = [];

  let current: Element | null = element;
  while (current && current !== document.body) {
    if (isScrollable(current)) {
      parents.push(current);
    }

    current = current.parentElement;
  }

  parents.push(window);
  return parents;
}

export interface OverlayAutoUpdateOptions {
  update: () => void;
  elements?: Array<Element | null | undefined>;
}

/**
 * Installs scroll/resize/element resize listeners and calls `update` on each change.
 * This utility keeps floating UI aligned during scroll and layout changes.
 */
export function autoUpdateOverlayPosition({ update, elements = [] }: OverlayAutoUpdateOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  let rafId = 0;
  const schedule = () => {
    if (rafId) {
      return;
    }

    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      update();
    });
  };

  const targets = new Set<EventTarget>();
  elements.filter(isElement).forEach((element) => {
    getScrollParents(element).forEach((target) => targets.add(target));
  });

  if (targets.size === 0) {
    targets.add(window);
  }

  targets.forEach((target) => {
    target.addEventListener('scroll', schedule, { passive: true, capture: true });
  });
  window.addEventListener('resize', schedule, { passive: true });

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => schedule());

    elements.filter(isElement).forEach((element) => resizeObserver?.observe(element));
    resizeObserver.observe(document.documentElement);
  }

  schedule();

  return () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    targets.forEach((target) => {
      target.removeEventListener('scroll', schedule, true);
    });
    window.removeEventListener('resize', schedule);

    resizeObserver?.disconnect();
  };
}

export function toRectLike(rect: DOMRect | ClientRect | RectLike): RectLike {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}
