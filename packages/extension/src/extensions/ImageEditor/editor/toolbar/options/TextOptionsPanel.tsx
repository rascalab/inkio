
import { useId } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import { BoldIcon, ItalicIcon } from '../../icons';
import { COLOR_PRESETS } from './colorPresets';

export function TextOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { textOptions } = state;
  const fontSizeId = useId();

  const isBold = textOptions.fontStyle.includes('bold');
  const isItalic = textOptions.fontStyle.includes('italic');

  const updateFontStyle = (bold: boolean, italic: boolean) => {
    let style: 'normal' | 'bold' | 'italic' | 'bold italic' = 'normal';
    if (bold && italic) style = 'bold italic';
    else if (bold) style = 'bold';
    else if (italic) style = 'italic';
    dispatch({ type: 'SET_TEXT_OPTIONS', options: { fontStyle: style } });
  };

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
              className={`inkio-ie-color-swatch${textOptions.color === c ? ' is-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => dispatch({ type: 'SET_TEXT_OPTIONS', options: { color: c } })}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={textOptions.color}
            onChange={(e) =>
              dispatch({ type: 'SET_TEXT_OPTIONS', options: { color: e.target.value } })
            }
          />
        </div>
      </div>

      <div className="inkio-ie-field">
        <label htmlFor={fontSizeId} className="inkio-ie-field-label">
          {locale.fontSize} <span className="inkio-ie-field-value">{textOptions.fontSize}px</span>
        </label>
        <input
          id={fontSizeId}
          type="range"
          className="inkio-ie-range-input"
          min={8}
          max={120}
          value={textOptions.fontSize}
          onChange={(e) =>
            dispatch({
              type: 'SET_TEXT_OPTIONS',
              options: { fontSize: parseInt(e.target.value, 10) },
            })
          }
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
