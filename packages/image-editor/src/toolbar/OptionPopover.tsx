import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdateOverlayPosition, computeOverlayPosition, useDismissableLayer } from '@inkio/core';

const EDITOR_POPOVER_OPEN_EVENT = 'inkio-ie-popover-open';
const FOCUSABLE = 'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [href], [tabindex="0"]';

interface OptionPopoverProps {
  readonly label: string;
  readonly summary?: ReactNode;
  readonly testId?: string;
  readonly popoverTestId?: string;
  readonly title?: string;
  readonly children: ReactNode;
}

export function OptionPopover({ label, summary, testId, popoverTestId, title = label, children }: OptionPopoverProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const viewport = rootRef.current?.closest('.inkio-ie-viewport');
  const host = viewport?.querySelector<HTMLElement>('.inkio-ie-overlay-host');
  const portalTarget = host ?? (typeof document !== 'undefined' ? document.body : null);

  useDismissableLayer({
    refs: [rootRef, popoverRef],
    enabled: isOpen,
    capture: true,
    escape: { insideOnly: true, preventDefault: true, stopPropagation: true },
    onDismiss: (reason) => {
      if (reason === 'escape') {
        triggerRef.current?.focus();
      } else if (popoverRef.current?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
      setIsOpen(false);
    },
  });

  useEffect(() => {
    if (!isOpen || !viewport) return;
    viewport.dispatchEvent(new CustomEvent(EDITOR_POPOVER_OPEN_EVENT, { detail: id }));
    const onOtherOpen = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== id) setIsOpen(false);
    };
    viewport.addEventListener(EDITOR_POPOVER_OPEN_EVENT, onOtherOpen);
    return () => viewport.removeEventListener(EDITOR_POPOVER_OPEN_EVENT, onOtherOpen);
  }, [id, isOpen, viewport]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const bounds = host?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      const width = Math.min(320, bounds.width - 24);
      const maxHeight = bounds.height - 24;
      const next = computeOverlayPosition({
        anchorRect: {
          top: rect.top - bounds.top, bottom: rect.bottom - bounds.top,
          left: rect.left - bounds.left, right: rect.right - bounds.left,
          width: rect.width, height: rect.height,
        },
        floatingRect: { width, height: Math.min(popover.scrollHeight + 2, maxHeight) },
        boundaryRect: { top: 0, left: 0, right: bounds.width, bottom: bounds.height, width: bounds.width, height: bounds.height },
        placement: 'bottom', align: 'start', offset: 8, padding: 12, flip: true, shift: true,
      });
      setPosition({ left: next.left, top: next.top, width, maxHeight });
    };
    update();
    const focusFrame = requestAnimationFrame(() => {
      if (document.activeElement !== trigger) return;
      (popover.querySelector<HTMLElement>(FOCUSABLE) ?? popover).focus({ preventScroll: true });
    });
    const stopUpdating = autoUpdateOverlayPosition({ update, elements: [trigger, popover] });
    return () => {
      cancelAnimationFrame(focusFrame);
      stopUpdating();
    };
  }, [host, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      lastFocusedRef.current = null;
      return;
    }
    const popover = popoverRef.current;
    const focused = lastFocusedRef.current;
    if (!popover || !focused || (popover.contains(focused) && !focused.matches(':disabled'))) return;
    const { activeElement, body } = popover.ownerDocument;
    if (activeElement !== body && activeElement !== focused) return;
    // An action can disable itself (e.g. moving an annotation to the front).
    // Keep focus in the popover so Escape and Tab still operate on it.
    (popover.querySelector<HTMLElement>(FOCUSABLE) ?? popover).focus({ preventScroll: true });
  }, [children, isOpen]);

  return (
    <div className="inkio-ie-option" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="inkio-ie-option-trigger"
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? id : undefined}
        title={title}
        data-testid={testId}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setIsOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || !isOpen) return;
          if (event.shiftKey) {
            setIsOpen(false);
          } else {
            event.preventDefault();
            const popover = popoverRef.current;
            (popover?.querySelector<HTMLElement>(FOCUSABLE) ?? popover)?.focus();
          }
        }}
      >
        <span className="inkio-ie-option-summary">{summary ?? label}</span>
        <span className="inkio-ie-option-chevron" aria-hidden="true" />
      </button>
      {isOpen && portalTarget && createPortal(
        <div
          ref={popoverRef}
          id={id}
          role="dialog"
          aria-label={label}
          data-testid={popoverTestId}
          className="inkio-ie-option-popover"
          style={position ?? { visibility: 'hidden' }}
          tabIndex={-1}
          onFocusCapture={(event) => {
            if (event.target instanceof HTMLElement) lastFocusedRef.current = event.target;
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE);
            const index = event.shiftKey ? 0 : controls.length - 1;
            if (controls.length && event.target !== controls[index]) return;
            triggerRef.current?.focus({ preventScroll: true });
            if (event.shiftKey) {
              event.preventDefault();
            } else {
              // Continue the browser's tab order from the trigger, not the portal host.
              setIsOpen(false);
            }
          }}
        >
          {children}
        </div>,
        portalTarget,
      )}
    </div>
  );
}
