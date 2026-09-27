import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  useDismissableLayer,
} from '@inkio/core';
import { PaletteIcon } from '../../icons';
import {
  colorToHsva,
  hsvaToCss,
  normalizeColor,
  parseColor,
  rgbaToCss,
} from '../../utils/color';

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

const EXCLUSIVE_EVENT = 'inkio-ie-color-picker-open';
const POPOVER_WIDTH = 296;
const POPOVER_GUTTER = 16;
const POPOVER_OFFSET = 12;
const POPOVER_ESTIMATED_HEIGHT = 388;

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'above' | 'below';
}

interface ColorPickerButtonProps {
  value: string;
  label: string;
  testId?: string;
  popoverTestId?: string;
  presets: string[];
  allowTransparent?: boolean;
  enableAlpha?: boolean;
  transparentLabel?: string;
  transparentTestId?: string;
  hexLabel: string;
  alphaLabel: string;
  paletteLabel: string;
  onChange: (value: string) => void;
}

function toColorString(h: number, s: number, v: number, a: number): string {
  return hsvaToCss({ h, s, v, a });
}

function normalizeHexInput(value: string): string {
  return value.startsWith('#') ? value : `#${value}`;
}

function toSwatchTestId(value: string): string {
  return `inkio-ie-color-swatch-${value.replace(/[^a-z0-9]+/gi, '').toLowerCase()}`;
}

export function ColorPickerButton({
  value,
  label,
  testId,
  popoverTestId = 'inkio-ie-color-picker',
  presets,
  allowTransparent = false,
  enableAlpha = true,
  transparentLabel,
  transparentTestId,
  hexLabel,
  alphaLabel,
  paletteLabel,
  onChange,
}: ColorPickerButtonProps) {
  const pickerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [hsva, setHsva] = useState(() => colorToHsva(value));
  const [hexInput, setHexInput] = useState(() => value.trim().toLowerCase() === 'transparent'
    ? '#00000000'
    : rgbaToCss(parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 }));
  const normalizedValue = useMemo(() => normalizeColor(value), [value]);

  useEffect(() => {
    setHsva(colorToHsva(value));
    setHexInput(value.trim().toLowerCase() === 'transparent'
      ? '#00000000'
      : rgbaToCss(parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 }));
  }, [value]);

  useDismissableLayer({
    refs: [rootRef, popoverRef],
    onDismiss: () => setIsOpen(false),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleExclusiveOpen = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== pickerId) {
        setIsOpen(false);
      }
    };

    window.addEventListener(EXCLUSIVE_EVENT, handleExclusiveOpen as EventListener);

    return () => {
      window.removeEventListener(EXCLUSIVE_EVENT, handleExclusiveOpen as EventListener);
    };
  }, [isOpen, pickerId]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      const overlayHost = rootRef.current?.closest('.inkio-ie-viewport')?.querySelector<HTMLElement>('.inkio-ie-overlay-host');
      const editorRoot = rootRef.current?.closest('.inkio-ie-root');
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const boundaryRect = overlayHost?.getBoundingClientRect()
        ?? editorRoot?.getBoundingClientRect()
        ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      const maxWidth = Math.min(POPOVER_WIDTH, Math.max(220, boundaryRect.width - (POPOVER_GUTTER * 2)));
      const maxHeight = Math.max(240, boundaryRect.height - (POPOVER_GUTTER * 2));
      const estimatedHeight = Math.min(POPOVER_ESTIMATED_HEIGHT, maxHeight);

      // The popover is absolutely positioned inside the boundary element, so
      // compute in boundary-relative coordinates. Prefer above the trigger;
      // flip below when that overflows less, and shift inside the gutter.
      const next = computeOverlayPosition({
        anchorRect: {
          top: rect.top - boundaryRect.top,
          bottom: rect.bottom - boundaryRect.top,
          left: rect.left - boundaryRect.left,
          right: rect.right - boundaryRect.left,
          width: rect.width,
          height: rect.height,
        },
        floatingRect: { width: maxWidth, height: estimatedHeight },
        boundaryRect: {
          top: 0,
          left: 0,
          right: boundaryRect.width,
          bottom: boundaryRect.height,
          width: boundaryRect.width,
          height: boundaryRect.height,
        },
        placement: 'top',
        align: 'start',
        offset: POPOVER_OFFSET,
        padding: POPOVER_GUTTER,
        flip: true,
        shift: true,
      });
      const placement = next.placement === 'top' ? 'above' : 'below';

      setPopoverPosition({
        left: next.left,
        // `.is-above` anchors the popover by its bottom edge (translateY(-100%)).
        top: placement === 'above' ? next.top + estimatedHeight : next.top,
        width: maxWidth,
        maxHeight,
        placement,
      });
    };

    updatePopoverPosition();

    return autoUpdateOverlayPosition({
      update: updatePopoverPosition,
      elements: [triggerRef.current],
    });
  }, [isOpen]);

  const commitColor = (nextHsva: typeof hsva) => {
    setHsva(nextHsva);
    onChange(toColorString(nextHsva.h, nextHsva.s, nextHsva.v, enableAlpha ? nextHsva.a : 1));
  };

  const handleBoardPointer = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const saturation = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const valueChannel = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

    commitColor({ ...hsva, s: saturation, v: valueChannel });
  };

  const handleBoardPointerDown = (event: {
    clientX: number;
    clientY: number;
    preventDefault: () => void;
  }) => {
    event.preventDefault();
    const handleMove = (moveEvent: PointerEvent) => handleBoardPointer(moveEvent.clientX, moveEvent.clientY);
    // One teardown identity for every path: the registered pointerup
    // listener must remove itself, otherwise it stays attached after
    // every drag (previously `handleUp` removed the wrong identity).
    const endBoardDrag = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', endBoardDrag);
      document.removeEventListener('pointercancel', handleCancel);
    };

    // pointercancel (interrupted drag) tears down the same way: without it
    // the listeners stay attached until the next pointerup somewhere.
    const handleCancel = () => {
      endBoardDrag();
    };

    handleBoardPointer(event.clientX, event.clientY);
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', endBoardDrag);
    document.addEventListener('pointercancel', handleCancel);
  };

  // Empty presets must fall through to the default swatch instead of
  // throwing inside parseColor (presets[0] would be undefined).
  const fallbackSwatch = presets.length > 0 ? parseColor(presets[0]) : undefined;
  const currentColor = allowTransparent && normalizedValue === 'transparent'
    ? 'transparent'
    : rgbaToCss(parseColor(value) ?? fallbackSwatch ?? { r: 17, g: 24, b: 39, a: 1 });
  const currentLabel = currentColor === 'transparent'
    ? transparentLabel ?? 'Transparent'
    : currentColor.toUpperCase();
  const portalTarget = rootRef.current?.closest('.inkio-ie-viewport')?.querySelector('.inkio-ie-overlay-host')
    ?? rootRef.current?.closest('.inkio-ie-root')
    ?? (typeof document !== 'undefined' ? document.body : null);

  return (
    <div className="inkio-ie-color-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="inkio-ie-color-picker-btn"
        aria-label={label}
        data-testid={testId}
        onClick={() => {
          setIsOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
              window.dispatchEvent(new CustomEvent(EXCLUSIVE_EVENT, { detail: pickerId }));
            }
            return nextOpen;
          });
        }}
      >
        <span
          className={`inkio-ie-color-picker-preview${currentColor === 'transparent' ? ' is-transparent' : ''}`}
          style={currentColor === 'transparent' ? undefined : { backgroundColor: currentColor }}
        />
        <span className="inkio-ie-color-picker-current-label">{currentLabel}</span>
        <PaletteIcon size={16} />
      </button>

      {isOpen && popoverPosition && portalTarget && createPortal(
        <div
          ref={popoverRef}
          className={`inkio-ie-color-picker-popover${popoverPosition?.placement === 'below' ? ' is-below' : ' is-above'}`}
          style={{
            left: `${popoverPosition.left}px`,
            top: `${popoverPosition.top}px`,
            width: `${popoverPosition.width}px`,
            maxHeight: `${popoverPosition.maxHeight}px`,
          }}
          data-testid={popoverTestId}
        >
          <div className="inkio-ie-color-picker-board-wrap">
            <div
              ref={boardRef}
              className="inkio-ie-color-picker-board"
              onPointerDown={handleBoardPointerDown}
              style={{
                backgroundColor: `hsl(${hsva.h} 100% 50%)`,
              }}
            >
              <div
                className="inkio-ie-color-picker-board-thumb"
                style={{
                  left: `${hsva.s * 100}%`,
                  top: `${(1 - hsva.v) * 100}%`,
                  backgroundColor: hsvaToCss({ ...hsva, a: 1 }),
                }}
              />
            </div>
          </div>

          <div className="inkio-ie-color-picker-slider-row">
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round(hsva.h)}
              className="inkio-ie-color-slider inkio-ie-color-slider--hue"
              aria-label={label}
              onChange={(event) => commitColor({ ...hsva, h: Number(event.target.value) })}
            />
          </div>

          <div className="inkio-ie-color-picker-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((enableAlpha ? hsva.a : 1) * 100)}
              className="inkio-ie-color-slider inkio-ie-color-slider--alpha"
              aria-label={alphaLabel}
              disabled={!enableAlpha}
              onChange={(event) => commitColor({ ...hsva, a: Number(event.target.value) / 100 })}
            />
          </div>

          <label className="inkio-ie-color-picker-field">
            <span className="inkio-ie-field-label">{hexLabel}</span>
            <div className="inkio-ie-color-picker-field-row">
              <input
                type="text"
                className="inkio-ie-field-input"
                value={hexInput}
                onChange={(event) => {
                  const nextValue = normalizeHexInput(event.target.value);
                  setHexInput(nextValue);
                  const parsed = parseColor(nextValue);
                  if (!parsed) {
                    return;
                  }

                  onChange(rgbaToCss({
                    ...parsed,
                    a: enableAlpha ? parsed.a : 1,
                  }));
                }}
                onBlur={() => {
                  setHexInput(normalizedValue === 'transparent'
                    ? '#00000000'
                    : rgbaToCss(parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 }));
                }}
              />
              {typeof window !== 'undefined' && window.EyeDropper && (
                <button
                  type="button"
                  className="inkio-ie-icon-action-btn"
                  aria-label={label}
                  onClick={async () => {
                    try {
                      const EyeDropperCtor = window.EyeDropper;
                      if (!EyeDropperCtor) {
                        return;
                      }

                      const eyeDropper = new EyeDropperCtor();
                      const result = await eyeDropper.open();
                      if (result?.sRGBHex) {
                        onChange(result.sRGBHex);
                      }
                    } catch {
                      // User cancelled the eyedropper.
                    }
                  }}
                >
                  <PaletteIcon size={16} />
                </button>
              )}
            </div>
          </label>

          <div className="inkio-ie-color-picker-palette">
            <span className="inkio-ie-field-label">{paletteLabel}</span>
            <div className="inkio-ie-control-row inkio-ie-control-row--wrap">
              {allowTransparent && (
                <button
                  type="button"
                  aria-label={transparentLabel}
                  data-testid={transparentTestId}
                  title={transparentLabel}
                  className={`inkio-ie-color-swatch inkio-ie-color-swatch--transparent${normalizedValue === 'transparent' ? ' is-active' : ''}`}
                  onClick={() => onChange('transparent')}
                />
              )}
              {presets.map((preset) => {
                const isActive = normalizeColor(preset) === normalizedValue;
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Color: ${preset}`}
                    title={`Color: ${preset}`}
                    data-testid={toSwatchTestId(preset)}
                    data-color={preset}
                    className={`inkio-ie-color-swatch${isActive ? ' is-active' : ''}`}
                    style={{ backgroundColor: preset }}
                    onClick={() => onChange(preset)}
                  />
                );
              })}
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </div>
  );
}
