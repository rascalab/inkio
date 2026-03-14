
import { useId } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import { BoldIcon, ItalicIcon } from '../../icons';
import { COLOR_PRESETS } from './colorPresets';
import type { TextAnnotationData } from '../../types';
import { getSelectedAnnotation, isTextAnnotation } from '../../utils/annotationTypes';

export function TextOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { textOptions } = state;
  const fontSizeId = useId();
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  const selectedText = isTextAnnotation(selectedAnnotation) ? selectedAnnotation : null;

  const fontStyle = selectedText?.fontStyle ?? textOptions.fontStyle;
  const fontSize = selectedText?.fontSize ?? textOptions.fontSize;
  const color = selectedText?.fill ?? textOptions.color;
  const isBold = fontStyle.includes('bold');
  const isItalic = fontStyle.includes('italic');

  const updateSelectedPreview = (updates: Partial<TextAnnotationData>) => {
    if (!selectedText) {
      return;
    }

    dispatch({ type: 'UPDATE_ANNOTATION', id: selectedText.id, updates });
  };

  const updateSelectedCommit = (updates: Partial<TextAnnotationData>) => {
    if (!selectedText) {
      return;
    }

    dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id: selectedText.id, updates });
  };

  const updateFontStyle = (bold: boolean, italic: boolean) => {
    let style: 'normal' | 'bold' | 'italic' | 'bold italic' = 'normal';
    if (bold && italic) style = 'bold italic';
    else if (bold) style = 'bold';
    else if (italic) style = 'italic';

    if (selectedText) {
      updateSelectedCommit({ fontStyle: style });
      return;
    }

    dispatch({ type: 'SET_TEXT_OPTIONS', options: { fontStyle: style } });
  };

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-title">
        {selectedText ? locale.selectedText : locale.textDefaults}
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
                if (selectedText) {
                  updateSelectedCommit({ fill: c });
                  return;
                }

                dispatch({ type: 'SET_TEXT_OPTIONS', options: { color: c } });
              }}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={color}
            onChange={(e) => {
              if (selectedText) {
                updateSelectedCommit({ fill: e.target.value });
                return;
              }

              dispatch({ type: 'SET_TEXT_OPTIONS', options: { color: e.target.value } });
            }}
          />
        </div>
      </div>

      <div className="inkio-ie-field">
        <label htmlFor={fontSizeId} className="inkio-ie-field-label">
          {locale.fontSize} <span className="inkio-ie-field-value">{fontSize}px</span>
        </label>
        <input
          id={fontSizeId}
          type="range"
          className="inkio-ie-range-input"
          min={8}
          max={120}
          value={fontSize}
          onChange={(e) => {
            const nextFontSize = parseInt(e.target.value, 10);
            if (selectedText) {
              updateSelectedPreview({ fontSize: nextFontSize });
              return;
            }

            dispatch({
              type: 'SET_TEXT_OPTIONS',
              options: { fontSize: nextFontSize },
            });
          }}
          onPointerUp={(e) => {
            if (!selectedText) {
              return;
            }

            updateSelectedCommit({ fontSize: parseInt((e.target as HTMLInputElement).value, 10) });
          }}
          onKeyUp={(e) => {
            if (!selectedText) {
              return;
            }

            updateSelectedCommit({ fontSize: parseInt((e.target as HTMLInputElement).value, 10) });
          }}
        />
      </div>

      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        <button
          type="button"
          className={`inkio-ie-icon-btn inkio-ie-font-btn${isBold ? ' is-active' : ''}`}
          title={locale.bold}
          onClick={() => updateFontStyle(!isBold, isItalic)}
        >
          <BoldIcon size={16} />
        </button>
        <button
          type="button"
          className={`inkio-ie-icon-btn inkio-ie-font-btn${isItalic ? ' is-active' : ''}`}
          title={locale.italic}
          onClick={() => updateFontStyle(isBold, !isItalic)}
        >
          <ItalicIcon size={16} />
        </button>
      </div>
    </div>
  );
}
