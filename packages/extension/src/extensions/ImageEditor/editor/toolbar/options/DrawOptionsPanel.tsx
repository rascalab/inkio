
import { useId } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import { COLOR_PRESETS } from './colorPresets';

export function DrawOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { drawOptions } = state;
  const brushSizeId = useId();
  const opacityId = useId();

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-field">
        <label className="inkio-ie-field-label">{locale.color}</label>
        <div className="inkio-ie-color-presets">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color: ${c}`}
              className={`inkio-ie-color-swatch${drawOptions.color === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => dispatch({ type: 'SET_DRAW_OPTIONS', options: { color: c } })}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={drawOptions.color}
            onChange={(e) =>
              dispatch({ type: 'SET_DRAW_OPTIONS', options: { color: e.target.value } })
            }
          />
        </div>
      </div>
      <div className="inkio-ie-field">
        <label htmlFor={brushSizeId} className="inkio-ie-field-label">
          {locale.brushSize} <span className="inkio-ie-field-value">{drawOptions.strokeWidth}</span>
        </label>
        <input
          id={brushSizeId}
          type="range"
          className="inkio-ie-range-input"
          min={1}
          max={50}
          value={drawOptions.strokeWidth}
          onChange={(e) =>
            dispatch({
              type: 'SET_DRAW_OPTIONS',
              options: { strokeWidth: parseInt(e.target.value, 10) },
            })
          }
        />
      </div>
      <div className="inkio-ie-field">
        <label htmlFor={opacityId} className="inkio-ie-field-label">
          {locale.opacity} <span className="inkio-ie-field-value">{Math.round(drawOptions.opacity * 100)}%</span>
        </label>
        <input
          id={opacityId}
          type="range"
          className="inkio-ie-range-input"
          min={0}
          max={1}
          step={0.05}
          value={drawOptions.opacity}
          onChange={(e) =>
            dispatch({
              type: 'SET_DRAW_OPTIONS',
              options: { opacity: parseFloat(e.target.value) },
            })
          }
        />
      </div>
    </div>
  );
}
