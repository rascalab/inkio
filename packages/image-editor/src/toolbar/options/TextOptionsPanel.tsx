
import { useImageEditor } from '../../hooks/use-image-editor';
import { COLOR_PRESETS } from '../../color-presets';
import type { TextAnnotationData } from '../../types';
import { getSelectedAnnotation, isTextAnnotation } from '../../utils/annotation-types';
import {
  ColorField,
  PanelSection,
  SelectField,
  SliderRow,
  TextStyleRow,
  ToolPanel,
} from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';

const FONT_FAMILY_OPTIONS = [
  { label: 'System Sans', value: 'system-ui' },
  { label: 'UI Sans', value: 'ui-sans-serif' },
  { label: 'UI Serif', value: 'ui-serif' },
  { label: 'UI Monospace', value: 'ui-monospace' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Courier New', value: 'Courier New' },
];

export function TextOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { textOptions } = state;
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  const selectedText = isTextAnnotation(selectedAnnotation) ? selectedAnnotation : null;

  const fontStyle = selectedText?.fontStyle ?? textOptions.fontStyle;
  const fontSize = selectedText?.fontSize ?? textOptions.fontSize;
  const fontFamily = selectedText?.fontFamily ?? textOptions.fontFamily;
  const color = selectedText?.fill ?? textOptions.color;
  const isBold = fontStyle.includes('bold');
  const isItalic = fontStyle.includes('italic');

  const updateSelectedPreview = (updates: Partial<TextAnnotationData>) => {
    if (!selectedText) {
      return;
    }

    dispatch({
      type: 'UPDATE_ANNOTATION',
      id: selectedText.id,
      updates,
    });
  };

  const updateSelectedCommit = (updates: Partial<TextAnnotationData>) => {
    if (!selectedText) {
      return;
    }

    dispatch({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: selectedText.id,
      updates,
    });
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
    <ToolPanel title={selectedText ? locale.selectedText : locale.textDefaults}>
      <PanelSection label={locale.color}>
        <ColorField
          label={locale.color}
          value={color}
          presets={COLOR_PRESETS}
          pickerTestId="inkio-ie-text-color-picker"
          enableAlpha
          hexLabel={locale.colorHex}
          alphaLabel={locale.colorAlpha}
          paletteLabel={locale.colorPalette}
          onChange={(nextColor) => {
            if (selectedText) {
              updateSelectedCommit({ fill: nextColor });
              return;
            }

            dispatch({ type: 'SET_TEXT_OPTIONS', options: { color: nextColor } });
          }}
        />
      </PanelSection>

      <PanelSection>
        <SelectField
          label={locale.fontFamily}
          value={fontFamily}
          options={FONT_FAMILY_OPTIONS}
          testId="inkio-ie-font-family-input"
          onChange={(nextFontFamily) => {
            if (selectedText) {
              updateSelectedCommit({ fontFamily: nextFontFamily || 'system-ui' });
              return;
            }

            dispatch({ type: 'SET_TEXT_OPTIONS', options: { fontFamily: nextFontFamily || 'system-ui' } });
          }}
        />
        <div className="inkio-ie-font-row">
          <div className="inkio-ie-font-size">
            <SliderRow
              presentation="popover"
              label={locale.fontSize}
              valueLabel={`${fontSize}px`}
              min={8}
              max={160}
              step={1}
              value={fontSize}
              rangeTestId="inkio-ie-text-font-size-range"
              numberTestId="inkio-ie-font-size"
              onPreviewChange={(nextFontSize) => {
                if (selectedText) {
                  updateSelectedPreview({ fontSize: nextFontSize });
                  return;
                }

                dispatch({
                  type: 'SET_TEXT_OPTIONS',
                  options: { fontSize: nextFontSize },
                });
              }}
              onCommitChange={(nextFontSize) => {
                if (!selectedText) {
                  return;
                }

                updateSelectedCommit({ fontSize: nextFontSize });
              }}
              onDirectChange={(nextFontSize) => {
                if (selectedText) {
                  updateSelectedCommit({ fontSize: nextFontSize });
                  return;
                }

                dispatch({
                  type: 'SET_TEXT_OPTIONS',
                  options: { fontSize: nextFontSize },
                });
              }}
            />
          </div>
          <TextStyleRow
            isBold={isBold}
            isItalic={isItalic}
            boldLabel={locale.bold}
            italicLabel={locale.italic}
            onToggleBold={() => updateFontStyle(!isBold, isItalic)}
            onToggleItalic={() => updateFontStyle(isBold, !isItalic)}
          />
        </div>
      </PanelSection>
      <LayerOrderControls annotationId={selectedText?.id ?? null} />
    </ToolPanel>
  );
}
