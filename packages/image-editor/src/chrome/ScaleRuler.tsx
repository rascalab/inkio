import type { ReactNode } from 'react';
import type { ImageEditorLocale } from '../types';

interface ScaleRulerProps {
  locale: ImageEditorLocale;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onFit: () => void;
  disabled?: boolean;
  width: number;
  dimensionsControl?: ReactNode;
  height: number;
}

export function ScaleRuler({
  locale, value, min, max, onChange, onFit, disabled, width, height, dimensionsControl,
}: ScaleRulerProps) {
  const start = Math.round(min * 100);
  const end = Math.round(max * 100);
  const percent = Math.round(value * 100);
  const label = `${percent}%`;

  return (
    <div className="inkio-ie-scale-ruler" data-testid="inkio-ie-zoom-controls">
      <input
        className="inkio-ie-scale-slider"
        data-testid="inkio-ie-zoom-slider"
        type="range"
        min={start}
        max={end}
        value={percent}
        disabled={disabled}
        aria-label={locale.scaleLabel ?? locale.zoom}
        aria-valuetext={label}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          onChange(next <= start ? min : next >= end ? max : next / 100);
        }}
      />
      <button
        className="inkio-ie-scale-fit"
        disabled={disabled}
        type="button"
        data-testid="inkio-ie-zoom-fit"
        onClick={onFit}
        aria-label={`${locale.fit} (${label})`}
        title={locale.fit}
      >
        <span data-testid="inkio-ie-zoom-label" aria-live="polite">{label}</span>
      </button>
      {dimensionsControl ?? (width > 0 && height > 0 && (
        <span className="inkio-ie-scale-size" data-testid="inkio-ie-scale-size">
          {Math.round(width)} × {Math.round(height)} px
        </span>
      ))}
    </div>
  );
}
