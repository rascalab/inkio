import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import {
  dragSource,
  dropMarkerRect,
  findHoveredBlock,
  isInEditor,
  moveTouchBlock,
  touchDropTarget,
  type BlockDragSource,
  type DropCoords,
  type HoveredBlock,
} from './block-drop';
import type { BlockDragVisuals } from './drag-visuals';

type PointerPoint = { pointerId: number; clientX: number; clientY: number };
type ScrollRegion = { element: Element; canScroll: boolean };
type TouchPress = PointerPoint & { source: BlockDragSource } & (
  | { preview: null }
  | { preview: HTMLDivElement; width: number; height: number; regions: ScrollRegion[] }
);

interface TouchBlockDragOptions {
  view: EditorView;
  handle: HTMLElement;
  signal: AbortSignal;
  visuals: BlockDragVisuals;
  hasNativeDrag: () => boolean;
  hasOpenMenu: () => boolean;
  getBlock: () => HoveredBlock | null;
  onPress: () => void;
  onLift: () => void;
  onReveal: (block: HoveredBlock) => void;
  onHide: () => void;
}

const TOUCH_THRESHOLD = 8;
const TOUCH_SCROLL_EDGE = 48;
const TOUCH_SCROLL_SPEED = 0.72; // px/ms at the edge

const movedPastThreshold = (start: DropCoords, end: DropCoords) =>
  Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY) >= TOUCH_THRESHOLD;

const touchScrollRegions = (editor: HTMLElement): ScrollRegion[] => {
  const doc = editor.ownerDocument;
  const regions: ScrollRegion[] = [];
  for (let element: HTMLElement | null = editor; element && element !== doc.documentElement; element = element.parentElement) {
    if (element === doc.scrollingElement) continue;
    const { overflowY } = getComputedStyle(element);
    const canScroll = overflowY === 'auto' || overflowY === 'scroll';
    if (canScroll || overflowY === 'hidden' || overflowY === 'clip') regions.unshift({ element, canScroll });
  }
  const root = doc.scrollingElement;
  const overflow = getComputedStyle(doc.documentElement).overflowY;
  const pageOverflow = overflow === 'visible' && doc.body ? getComputedStyle(doc.body).overflowY : overflow;
  if (root && pageOverflow !== 'hidden' && pageOverflow !== 'clip') regions.unshift({ element: root, canScroll: true });
  return regions;
};

const scrollTouchEdge = (regions: ScrollRegion[], y: number, viewportHeight: number, elapsed: number) => {
  let top = 0;
  let bottom = viewportHeight;
  let target: Element | undefined;
  let speed = 0;
  for (const { element, canScroll } of regions) {
    if (element !== element.ownerDocument.scrollingElement) {
      const edge = element.getBoundingClientRect().top + element.clientTop;
      top = Math.max(top, edge);
      bottom = Math.min(bottom, edge + element.clientHeight);
    }
    const threshold = Math.min(TOUCH_SCROLL_EDGE, (bottom - top) / 3);
    if (!canScroll || threshold <= 0 || y < top || y >= bottom) continue;
    const down = (y - bottom + threshold) / threshold;
    const up = (top + threshold - y) / threshold;
    if (down > 0 && element.scrollTop < element.scrollHeight - element.clientHeight - 0.5) {
      target = element;
      speed = down;
    } else if (up > 0 && element.scrollTop > 0) {
      target = element;
      speed = -up;
    }
  }
  if (!target) return false;
  const before = target.scrollTop;
  const step = Math.sign(speed) * Math.max(1, Math.round(Math.abs(speed) * TOUCH_SCROLL_SPEED * elapsed));
  target.scrollTo({ top: before + step, behavior: 'instant' });
  return target.scrollTop !== before;
};

export const createTouchBlockDrag = ({
  view,
  handle,
  signal,
  visuals,
  hasNativeDrag,
  hasOpenMenu,
  getBlock,
  onPress,
  onLift,
  onReveal,
  onHide,
}: TouchBlockDragOptions) => {
  const listener = { signal };
  const capture = { signal, capture: true };
  let press: TouchPress | null = null;
  let tap: (PointerPoint & { doc: ProseMirrorNode }) | null = null;
  let completedTouch: PointerPoint | null = null;
  let keepsHandle = false;
  let scrollFrame = 0;
  let lastScrollAt: number | undefined;

  const showMarker = (current: TouchPress) => {
    visuals.showMarker(touchDropTarget(view, current.source, current)?.gap ?? null);
  };

  const tickScroll = (now: number) => {
    const current = press;
    const elapsed = Math.min(32, now - (lastScrollAt ?? now - 1000 / 60));
    if (!current?.preview || !scrollTouchEdge(current.regions, current.clientY, window.innerHeight, elapsed)) {
      scrollFrame = 0;
      lastScrollAt = undefined;
      return;
    }
    lastScrollAt = now;
    // Resolve the target against the scrolled layout even if the finger is still.
    showMarker(current);
    scrollFrame = requestAnimationFrame(tickScroll);
  };

  const clearPress = () => {
    const current = press;
    press = null;
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    lastScrollAt = undefined;
    if (!current) return;
    handle.draggable = true;
    if (handle.hasPointerCapture?.(current.pointerId)) handle.releasePointerCapture(current.pointerId);
    if (current.preview) {
      visuals.clearMarker();
      visuals.clearPreview();
      handle.classList.remove('is-touch-dragging');
    }
  };

  const hide = () => {
    keepsHandle = false;
    onHide();
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || !event.isPrimary || !view.editable || hasNativeDrag() || press) return;
    const block = getBlock();
    if (!block) return;
    const source = dragSource(view, { ...block, doc: view.state.doc });
    if (!source) return;

    // Only the grip captures; editor content keeps native taps, selection and panning.
    const { pointerId, clientX, clientY } = event;
    handle.setPointerCapture(pointerId);
    handle.draggable = false;
    event.preventDefault();
    press = { preview: null, pointerId, clientX, clientY, source };
    onPress();
  }, listener);

  handle.addEventListener('pointermove', (event) => {
    let current = press;
    const { pointerId, clientX, clientY } = event;
    if (!current || current.pointerId !== pointerId) return;
    if (!current.preview) {
      if (!movedPastThreshold(current, event)) return;
      onLift();
      if (press !== current) return;
      const preview = visuals.mountPreview(current.source.blockElement, 'touch');
      current = press = {
        pointerId, clientX, clientY, source: current.source, preview,
        width: preview.offsetWidth, height: preview.offsetHeight, regions: touchScrollRegions(view.dom),
      };
      handle.classList.add('is-touch-dragging');
    }
    current.clientX = clientX;
    current.clientY = clientY;
    const x = Math.max(4, Math.min(clientX + 12, window.innerWidth - current.width - 4));
    const y = clientY + current.height + 16 <= window.innerHeight
      ? clientY + 14
      : Math.max(4, clientY - current.height - 14);
    current.preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    showMarker(current);
    if (!scrollFrame) scrollFrame = requestAnimationFrame(tickScroll);
  }, listener);

  handle.addEventListener('pointerup', (event) => {
    const current = press;
    const { pointerId, clientX, clientY } = event;
    if (!current || current.pointerId !== pointerId) return;
    completedTouch = { pointerId, clientX, clientY };
    const target = current.preview ? touchDropTarget(view, current.source, event) : null;
    clearPress();
    if (!current.preview && !movedPastThreshold(current, event)) {
      // WebKit need not synthesize a click after a captured touch press.
      handle.click();
      return;
    }
    hide();
    if (target && view.editable && view.state.doc === current.source.doc && dropMarkerRect(view, target.gap)) {
      moveTouchBlock(view, current.source, target);
    }
  }, listener);

  const cancelGrip = (event: PointerEvent) => {
    if (press?.pointerId !== event.pointerId) return;
    clearPress();
    hide();
  };
  handle.addEventListener('pointercancel', cancelGrip, listener);
  handle.addEventListener('lostpointercapture', cancelGrip, listener);

  const doc = view.dom.ownerDocument;
  doc.addEventListener('pointerdown', (event) => {
    completedTouch = null;
    if (!keepsHandle || hasOpenMenu() || !(event.target instanceof Node)) return;
    if (!view.dom.contains(event.target) && !handle.contains(event.target)) {
      clearPress();
      hide();
    }
  }, capture);

  doc.addEventListener('click', (event) => {
    // The browser's compatibility click can hit a freshly opened menu item.
    if (!completedTouch || !event.isTrusted || event.detail === 0 || movedPastThreshold(completedTouch, event)) return;
    if (event instanceof PointerEvent && event.pointerId > 0 && event.pointerId !== completedTouch.pointerId) return;
    completedTouch = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, capture);

  return {
    get isPressed() { return press !== null; },
    get keepsHandle() { return keepsHandle; },
    forgetHandle() { keepsHandle = false; },
    pointerDown(event: PointerEvent) {
      if (event.pointerType === 'touch' && event.isPrimary && view.editable && !hasNativeDrag() && !press) {
        const { pointerId, clientX, clientY } = event;
        tap = { pointerId, clientX, clientY, doc: view.state.doc };
      }
    },
    pointerUp(event: PointerEvent) {
      const start = tap;
      if (!start || start.pointerId !== event.pointerId) return;
      tap = null;
      if (!view.editable || start.doc !== view.state.doc || movedPastThreshold(start, event) || !isInEditor(view, event)) return;
      const hovered = findHoveredBlock(view, event.clientX, event.clientY);
      if (hovered && event.target instanceof Node && hovered.blockElement.contains(event.target)) {
        keepsHandle = true;
        onReveal(hovered);
      }
    },
    pointerMove(event: PointerEvent) {
      if (tap?.pointerId === event.pointerId && movedPastThreshold(tap, event)) tap = null;
    },
    pointerCancel(event: PointerEvent) {
      if (tap?.pointerId === event.pointerId) tap = null;
    },
    refreshMarker() {
      // Auto-scroll already measures after changing the scroll position.
      if (!scrollFrame && press?.preview) showMarker(press);
    },
    update() {
      if (tap && (!view.editable || view.state.doc !== tap.doc)) tap = null;
      if (press && (!view.editable || view.state.doc !== press.source.doc)) {
        clearPress();
        return true;
      }
      return false;
    },
    destroy() {
      clearPress();
      tap = null;
      completedTouch = null;
      keepsHandle = false;
    },
  };
};
