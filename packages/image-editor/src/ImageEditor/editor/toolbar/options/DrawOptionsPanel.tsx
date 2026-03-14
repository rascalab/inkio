
import { useId } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import type { FreeDrawAnnotation } from '../../types';
import { COLOR_PRESETS } from './colorPresets';
import { getSelectedAnnotation, isDrawAnnotation } from '../../utils/annotationTypes';

export function DrawOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { drawOptions } = state;
  const brushSizeId = useId();
  const opacityId = useId();
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  const selectedDraw = isDrawAnnotation(selectedAnnotation) ? selectedAnnotation : null;

  const color = selectedDraw?.stroke ?? drawOptions.color;
  const strokeWidth = selectedDraw?.strokeWidth ?? drawOptions.strokeWidth;
  const opacity = selectedDraw?.opacity ?? drawOptions.opacity;

  const updateSelectedPreview = (updates: Partial<FreeDrawAnnotation>) => {
    if (!selectedDraw) {
      return;
    }

    dispatch({ type: 'UPDATE_ANNOTATION', id: selectedDraw.id, updates });
  };

  const updateSelectedCommit = (updates: Partial<FreeDrawAnnotation>) => {
    if (!selectedDraw) {
      return;
    }

    dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id: selectedDraw.id, updates });
  };

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-title">
        {selectedDraw ? locale.selectedDraw : locale.drawDefaults}
      </div>
      <div className="inkio-ie-field">
        <label className="inkio-ie-field-label">{locale.color}</label>
        <div className="inkio-ie-color-presets">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color: ${c}`}
              className={`inkio-ie-color-swatch${color === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                if (selectedDraw) {
                  updateSelectedCommit({ stroke: c });
                  return;
                }

                dispatch({ type: 'SET_DRAW_OPTIONS', options: { color: c } });
              }}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={color}
            onChange={(e) => {
              if (selectedDraw) {
                updateSelectedCommit({ stroke: e.target.value });
                return;
              }

              dispatch({ type: 'SET_DRAW_OPTIONS', options: { color: e.target.value } });
            }}
          />
        </div>
      </div>
      <div className="inkio-ie-field">
        <label htmlFor={brushSizeId} className="inkio-ie-field-label">
          {locale.brushSize} <span className="inkio-ie-field-value">{strokeWidth}</span>
        </label>
        <input
          id={brushSizeId}
          type="range"
          className="inkio-ie-range-input"
          min={1}
          max={50}
          value={strokeWidth}
          onChange={(e) => {
            const nextStrokeWidth = parseInt(e.target.value, 10);
            if (selectedDraw) {
              updateSelectedPreview({ strokeWidth: nextStrokeWidth });
              return;
            }

            dispatch({
              type: 'SET_DRAW_OPTIONS',
              options: { strokeWidth: nextStrokeWidth },
            });
          }}
          onPointerUp={(e) => {
            if (!selectedDraw) {
              return;
            }

            updateSelectedCommit({ strokeWidth: parseInt((e.target as HTMLInputElement).value, 10) });
          }}
          onKeyUp={(e) => {
            if (!selectedDraw) {
              return;
            }

            updateSelectedCommit({ strokeWidth: parseInt((e.target as HTMLInputElement).value, 10) });
          }}
        />
      </div>
      <div className="inkio-ie-field">
        <label htmlFor={opacityId} className="inkio-ie-field-label">
          {locale.opacity} <span className="inkio-ie-field-value">{Math.round(opacity * 100)}%</span>
        </label>
        <input
          id={opacityId}
          type="range"
          className="inkio-ie-range-input"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => {
            const nextOpacity = parseFloat(e.target.value);
            if (selectedDraw) {
              updateSelectedPreview({ opacity: nextOpacity });
              return;
            }

            dispatch({
              type: 'SET_DRAW_OPTIONS',
              options: { opacity: nextOpacity },
            });
          }}
          onPointerUp={(e) => {
            if (!selectedDraw) {
              return;
            }

            updateSelectedCommit({ opacity: parseFloat((e.target as HTMLInputElement).value) });
          }}
          onKeyUp={(e) => {
            if (!selectedDraw) {
              return;
            }

            updateSelectedCommit({ opacity: parseFloat((e.target as HTMLInputElement).value) });
          }}
        />
      </div>
    </div>
  );
}
