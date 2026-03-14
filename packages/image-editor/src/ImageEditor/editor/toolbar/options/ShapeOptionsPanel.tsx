import React, { useMemo, useId } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import { RectIcon, EllipseIcon, ArrowIcon, LineIcon } from '../../icons';
import { COLOR_PRESETS } from './colorPresets';
import type { ShapeType } from '../../types';
import { getSelectedAnnotation, isShapeAnnotation, type ShapeAnnotation } from '../../utils/annotationTypes';

interface ShapeButton {
  type: ShapeType;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

export function ShapeOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { shapeOptions } = state;
  const strokeWidthId = useId();
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  const selectedShape = isShapeAnnotation(selectedAnnotation) ? selectedAnnotation : null;
  const canEditFill = !selectedShape || selectedShape.type === 'rect' || selectedShape.type === 'ellipse';
  const currentShapeType = selectedShape?.type ?? shapeOptions.shapeType;
  const fill = selectedShape && 'fill' in selectedShape ? selectedShape.fill : shapeOptions.fill;
  const stroke = selectedShape?.stroke ?? shapeOptions.stroke;
  const strokeWidth = selectedShape?.strokeWidth ?? shapeOptions.strokeWidth;

  const shapeButtons = useMemo<ShapeButton[]>(
    () => [
      { type: 'rect', Icon: RectIcon, label: locale.rectangle },
      { type: 'ellipse', Icon: EllipseIcon, label: locale.ellipse },
      { type: 'arrow', Icon: ArrowIcon, label: locale.arrow },
      { type: 'line', Icon: LineIcon, label: locale.line },
    ],
    [locale.arrow, locale.ellipse, locale.line, locale.rectangle],
  );

  const updateSelectedPreview = (updates: Partial<ShapeAnnotation>) => {
    if (!selectedShape) {
      return;
    }

    dispatch({ type: 'UPDATE_ANNOTATION', id: selectedShape.id, updates });
  };

  const updateSelectedCommit = (updates: Partial<ShapeAnnotation>) => {
    if (!selectedShape) {
      return;
    }

    dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id: selectedShape.id, updates });
  };

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-title">
        {selectedShape ? locale.selectedShape : locale.shapeDefaults}
      </div>
      {!selectedShape && (
        <>
          <div className="inkio-ie-options-label">{locale.shapes}</div>
          <div className="inkio-ie-options-row inkio-ie-options-row--gap">
            {shapeButtons.map(({ type, Icon, label }) => (
              <button
                key={type}
                type="button"
                className={`inkio-ie-icon-btn${currentShapeType === type ? ' is-active' : ''}`}
                title={label}
                onClick={() =>
                  dispatch({ type: 'SET_SHAPE_OPTIONS', options: { shapeType: type } })
                }
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </>
      )}

      {canEditFill && (
        <div className="inkio-ie-field">
          <label className="inkio-ie-field-label">{locale.fill}</label>
          <div className="inkio-ie-color-presets">
            <button
              type="button"
              aria-label="Color: transparent"
              className={`inkio-ie-color-swatch inkio-ie-color-swatch--transparent${fill === 'transparent' ? ' is-active' : ''}`}
              onClick={() => {
                if (selectedShape) {
                  updateSelectedCommit({ fill: 'transparent' });
                  return;
                }

                dispatch({ type: 'SET_SHAPE_OPTIONS', options: { fill: 'transparent' } });
              }}
            />
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color: ${c}`}
                className={`inkio-ie-color-swatch${fill === c ? ' is-active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  if (selectedShape) {
                    updateSelectedCommit({ fill: c });
                    return;
                  }

                  dispatch({ type: 'SET_SHAPE_OPTIONS', options: { fill: c } });
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="inkio-ie-field">
        <label className="inkio-ie-field-label">{locale.stroke}</label>
        <div className="inkio-ie-color-presets">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color: ${c}`}
              className={`inkio-ie-color-swatch${stroke === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                if (selectedShape) {
                  updateSelectedCommit({ stroke: c });
                  return;
                }

                dispatch({ type: 'SET_SHAPE_OPTIONS', options: { stroke: c } });
              }}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={stroke}
            onChange={(event) => {
              if (selectedShape) {
                updateSelectedCommit({ stroke: event.target.value });
                return;
              }

              dispatch({ type: 'SET_SHAPE_OPTIONS', options: { stroke: event.target.value } });
            }}
          />
        </div>
      </div>

      <div className="inkio-ie-field">
        <label htmlFor={strokeWidthId} className="inkio-ie-field-label">
          {locale.stroke} <span className="inkio-ie-field-value">{strokeWidth}</span>
        </label>
        <input
          id={strokeWidthId}
          type="range"
          className="inkio-ie-range-input"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(event) => {
            const nextStrokeWidth = parseInt(event.target.value, 10);
            if (selectedShape) {
              updateSelectedPreview({ strokeWidth: nextStrokeWidth });
              return;
            }

            dispatch({
              type: 'SET_SHAPE_OPTIONS',
              options: { strokeWidth: nextStrokeWidth },
            });
          }}
          onPointerUp={(event) => {
            if (!selectedShape) {
              return;
            }

            updateSelectedCommit({ strokeWidth: parseInt((event.target as HTMLInputElement).value, 10) });
          }}
          onKeyUp={(event) => {
            if (!selectedShape) {
              return;
            }

            updateSelectedCommit({ strokeWidth: parseInt((event.target as HTMLInputElement).value, 10) });
          }}
        />
      </div>
    </div>
  );
}
