import React, { useMemo, useId } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import { RectIcon, EllipseIcon, ArrowIcon, LineIcon } from '../../icons';
import { COLOR_PRESETS } from './colorPresets';
import type { ShapeType } from '../../types';

interface ShapeButton {
  type: ShapeType;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

export function ShapeOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { shapeOptions } = state;
  const strokeWidthId = useId();

  const shapeButtons = useMemo<ShapeButton[]>(
    () => [
      { type: 'rect', Icon: RectIcon, label: locale.rectangle },
      { type: 'ellipse', Icon: EllipseIcon, label: locale.ellipse },
      { type: 'arrow', Icon: ArrowIcon, label: locale.arrow },
      { type: 'line', Icon: LineIcon, label: locale.line },
    ],
    [locale.arrow, locale.ellipse, locale.line, locale.rectangle],
  );

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-label">{locale.shapes}</div>
      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        {shapeButtons.map(({ type, Icon, label }) => (
          <button
            key={type}
            type="button"
            className={`inkio-ie-icon-btn${shapeOptions.shapeType === type ? ' is-active' : ''}`}
            title={label}
            onClick={() =>
              dispatch({ type: 'SET_SHAPE_OPTIONS', options: { shapeType: type } })
            }
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="inkio-ie-field">
        <label className="inkio-ie-field-label">{locale.fill}</label>
        <div className="inkio-ie-color-presets">
          <button
            type="button"
            aria-label="Color: transparent"
            className={`inkio-ie-color-swatch inkio-ie-color-swatch--transparent${shapeOptions.fill === 'transparent' ? ' is-active' : ''}`}
            onClick={() => dispatch({ type: 'SET_SHAPE_OPTIONS', options: { fill: 'transparent' } })}
          />
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color: ${c}`}
              className={`inkio-ie-color-swatch${shapeOptions.fill === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => dispatch({ type: 'SET_SHAPE_OPTIONS', options: { fill: c } })}
            />
          ))}
        </div>
      </div>

      <div className="inkio-ie-field">
        <label className="inkio-ie-field-label">{locale.stroke}</label>
        <div className="inkio-ie-color-presets">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color: ${c}`}
              className={`inkio-ie-color-swatch${shapeOptions.stroke === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => dispatch({ type: 'SET_SHAPE_OPTIONS', options: { stroke: c } })}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={shapeOptions.stroke}
            onChange={(event) =>
              dispatch({ type: 'SET_SHAPE_OPTIONS', options: { stroke: event.target.value } })
            }
          />
        </div>
      </div>

      <div className="inkio-ie-field">
        <label htmlFor={strokeWidthId} className="inkio-ie-field-label">
          {locale.stroke} <span className="inkio-ie-field-value">{shapeOptions.strokeWidth}</span>
        </label>
        <input
          id={strokeWidthId}
          type="range"
          className="inkio-ie-range-input"
          min={1}
          max={20}
          value={shapeOptions.strokeWidth}
          onChange={(event) =>
            dispatch({
              type: 'SET_SHAPE_OPTIONS',
              options: { strokeWidth: parseInt(event.target.value, 10) },
            })
          }
        />
      </div>
    </div>
  );
}
