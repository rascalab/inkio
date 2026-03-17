import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleExclusiveOpen = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== pickerId) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener(EXCLUSIVE_EVENT, handleExclusiveOpen as EventListener);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
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
      const relativeLeft = rect.left - boundaryRect.left;
      const relativeTop = rect.top - boundaryRect.top;
      const relativeBottom = rect.bottom - boundaryRect.top;
      const left = Math.min(
        Math.max(POPOVER_GUTTER, relativeLeft),
        Math.max(POPOVER_GUTTER, boundaryRect.width - maxWidth - POPOVER_GUTTER),
      );
      const estimatedHeight = Math.min(POPOVER_ESTIMATED_HEIGHT, maxHeight);
      const spaceAbove = relativeTop - POPOVER_GUTTER;
      const spaceBelow = boundaryRect.height - relativeBottom - POPOVER_GUTTER;
      const placement = spaceAbove >= estimatedHeight || spaceAbove >= spaceBelow
        ? 'above'
        : 'below';
      const top = placement === 'above'
        ? Math.min(
            boundaryRect.height - POPOVER_GUTTER,
            Math.max(estimatedHeight + POPOVER_GUTTER, relativeTop - POPOVER_OFFSET),
          )
        : Math.max(
            POPOVER_GUTTER,
            Math.min(boundaryRect.height - estimatedHeight - POPOVER_GUTTER, relativeBottom + POPOVER_OFFSET),
          );

      setPopoverPosition({
        left,
        top,
        width: maxWidth,
        maxHeight,
        placement,
      });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
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
    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    handleBoardPointer(event.clientX, event.clientY);
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  const currentColor = allowTransparent && normalizedValue === 'transparent'
    ? 'transparent'
    : rgbaToCss(parseColor(value) ?? parseColor(presets[0]) ?? { r: 17, g: 24, b: 39, a: 1 });
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
