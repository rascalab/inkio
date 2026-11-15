import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdateOverlayPosition, computeOverlayPosition, useDismissableLayer } from '@inkio/core';

const EDITOR_POPOVER_OPEN_EVENT = 'inkio-ie-color-picker-open';

interface OptionPopoverProps {
  readonly label: string;
  readonly summary?: ReactNode;
  readonly testId?: string;
  readonly popoverTestId?: string;
  readonly title?: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

export function OptionPopover({ label, summary, testId, popoverTestId, title = label, defaultOpen = false, children }: OptionPopoverProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const host = rootRef.current?.closest('.inkio-ie-viewport')?.querySelector<HTMLElement>('.inkio-ie-overlay-host');
  const portalTarget = host ?? (typeof document !== 'undefined' ? document.body : null);

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  useDismissableLayer({
    refs: [rootRef, popoverRef],
    enabled: isOpen,
    capture: true,
    escape: { preventDefault: true, stopPropagation: true },
    onDismiss: (reason) => {
      setIsOpen(false);
      if (reason === 'escape') triggerRef.current?.focus();
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new CustomEvent(EDITOR_POPOVER_OPEN_EVENT, { detail: id }));
    const onOtherOpen = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== id) setIsOpen(false);
    };
    window.addEventListener(EDITOR_POPOVER_OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(EDITOR_POPOVER_OPEN_EVENT, onOtherOpen);
  }, [id, isOpen]);

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
      if (popover.contains(document.activeElement)) return;
      popover.querySelector<HTMLElement>('input:not(:disabled), textarea, select, button:not(:disabled)')?.focus();
    });
    const stopUpdating = autoUpdateOverlayPosition({ update, elements: [trigger, popover] });
    return () => {
      cancelAnimationFrame(focusFrame);
      stopUpdating();
    };
  }, [host, isOpen]);

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
        onClick={() => setIsOpen((open) => !open)}
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
        >
          {children}
        </div>,
        portalTarget,
      )}
    </div>
  );
}
