import { useEffect, useMemo, useRef, useState } from 'react';
import { COLOR_PRESETS } from '../color-presets';
import type { ImageEditorLocale } from '../types';
import { PaletteIcon } from '../icons';
import { OptionPopover } from './OptionPopover';
import {
  colorToHsva,
  hsvaToCss,
  normalizeColor,
  parseColor,
  rgbaToCss,
} from '../utils/color';

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

interface ColorPickerButtonProps {
  value: string;
  label: string;
  testId?: string;
  locale: ImageEditorLocale;
  allowTransparent?: boolean;
  enableAlpha?: boolean;
  transparentLabel?: string;
  transparentTestId?: string;
  onChange: (value: string) => void;
}

function displayHex(value: string): string {
  return value.trim().toLowerCase() === 'transparent'
    ? '#00000000'
    : rgbaToCss(parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 });
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
  allowTransparent = false,
  enableAlpha = true,
  transparentLabel,
  transparentTestId,
  locale: { colorHex: hexLabel = 'Hex color', colorAlpha: alphaLabel = 'Opacity', colorPalette: paletteLabel = 'Color palette' },
  onChange,
}: ColorPickerButtonProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [hsva, setHsva] = useState(() => colorToHsva(value));
  const [hexInput, setHexInput] = useState(() => displayHex(value));
  const normalizedValue = useMemo(() => normalizeColor(value), [value]);

  useEffect(() => {
    setHsva(colorToHsva(value));
    setHexInput(displayHex(value));
  }, [value]);

  const commitColor = (nextHsva: typeof hsva) => {
    setHsva(nextHsva);
    onChange(hsvaToCss(enableAlpha ? nextHsva : { ...nextHsva, a: 1 }));
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
      document.removeEventListener('pointercancel', endBoardDrag);
    };

    handleBoardPointer(event.clientX, event.clientY);
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', endBoardDrag);
    document.addEventListener('pointercancel', endBoardDrag);
  };

  const currentColor = allowTransparent && normalizedValue === 'transparent'
    ? 'transparent'
    : rgbaToCss(parseColor(value) ?? parseColor(COLOR_PRESETS[0] ?? '') ?? { r: 17, g: 24, b: 39, a: 1 });
  const currentLabel = currentColor === 'transparent'
    ? transparentLabel ?? 'Transparent'
    : currentColor.toUpperCase();
  return (
    <div className="inkio-ie-color-picker">
      <OptionPopover
        label={label}
        title={`${label}: ${currentLabel}`}
        testId={testId}
        popoverTestId="inkio-ie-color-picker"
        summary={<>
        <span
          className={`inkio-ie-color-picker-preview${currentColor === 'transparent' ? ' is-transparent' : ''}`}
          style={currentColor === 'transparent' ? undefined : { backgroundColor: currentColor }}
        />
        <span className="inkio-ie-color-picker-current-label">{label}</span>
        <PaletteIcon size={16} />
        </>}
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
                onBlur={() => setHexInput(displayHex(value))}
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
              {COLOR_PRESETS.map((preset) => {
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
      </OptionPopover>
    </div>
  );
}
