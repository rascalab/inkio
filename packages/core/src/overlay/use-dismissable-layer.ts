import { useEffect, useRef, type RefObject } from 'react';

export type DismissReason = 'outside' | 'escape';

export interface DismissableLayerEscapeOptions {
  /** Only dismiss when the keydown target is inside one of `refs`. */
  insideOnly?: boolean;
  /** Call `event.stopPropagation()` when dismissing. */
  stopPropagation?: boolean;
  /** Call `event.preventDefault()` when dismissing. */
  preventDefault?: boolean;
}

export interface UseDismissableLayerOptions {
  /**
   * Elements that make up the layer (popover, trigger, ...). Pointer-downs
   * inside any of them never dismiss.
   */
  refs: ReadonlyArray<RefObject<Element | null>>;
  /** Called on outside pointer-down or Escape. Latest value is always used. */
  onDismiss: (reason: DismissReason, event: Event) => void;
  /** Listeners are attached only while enabled. Defaults to true. */
  enabled?: boolean;
  /**
   * Delay before the outside pointer-down listener is armed, so the very
   * click that opened the layer doesn't close it. `undefined` arms
   * synchronously; `0` arms on the next macrotask. Escape is always armed
   * immediately.
   */
  armDelayMs?: number;
  /** Register the document listeners in the capture phase. Default false. */
  capture?: boolean;
  /**
   * Escape handling: `true` (default) dismisses on any document Escape,
   * `false` disables it, or pass options. Escape during IME composition
   * (`event.isComposing`, e.g. Korean input) is always ignored.
   */
  escape?: boolean | DismissableLayerEscapeOptions;
}

function isInside(refs: ReadonlyArray<RefObject<Element | null>>, target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  return refs.some((ref) => ref.current?.contains(target) ?? false);
}

/**
 * Shared outside-click + Escape dismissal for popovers and menus.
 */
export function useDismissableLayer({
  refs,
  onDismiss,
  enabled = true,
  armDelayMs,
  capture = false,
  escape = true,
}: UseDismissableLayerOptions): void {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const escapeEnabled = escape !== false;
  const escapeOptions = typeof escape === 'object' ? escape : {};
  const insideOnly = escapeOptions.insideOnly ?? false;
  const stopPropagation = escapeOptions.stopPropagation ?? false;
  const preventDefault = escapeOptions.preventDefault ?? false;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const currentRefs = refsRef.current;
      // Without any mounted layer element there is nothing to be outside of.
      if (!currentRefs.some((ref) => ref.current)) return;
      if (isInside(currentRefs, event.target)) return;
      onDismissRef.current('outside', event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      if (insideOnly && !isInside(refsRef.current, event.target)) return;
      if (stopPropagation) event.stopPropagation();
      if (preventDefault) event.preventDefault();
      onDismissRef.current('escape', event);
    };

    let armed = false;
    const arm = () => {
      armed = true;
      document.addEventListener('mousedown', handlePointerDown, capture);
    };
    const timer = armDelayMs === undefined ? null : setTimeout(arm, armDelayMs);
    if (timer === null) arm();

    if (escapeEnabled) {
      document.addEventListener('keydown', handleKeyDown, capture);
    }

    return () => {
      if (timer !== null) clearTimeout(timer);
      if (armed) document.removeEventListener('mousedown', handlePointerDown, capture);
      if (escapeEnabled) document.removeEventListener('keydown', handleKeyDown, capture);
    };
  }, [enabled, armDelayMs, capture, escapeEnabled, insideOnly, stopPropagation, preventDefault]);
}
