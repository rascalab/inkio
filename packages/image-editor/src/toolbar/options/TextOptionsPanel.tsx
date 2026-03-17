
import { useEffect, useState } from 'react';
import { useImageEditor } from '../../hooks/use-image-editor';
import { COLOR_PRESETS } from '../../color-presets';
import type { TextAnnotationData } from '../../types';
import { getSelectedAnnotation, isTextAnnotation } from '../../utils/annotation-types';
import {
  ColorSwatchGroup,
  ControlCard,
  RangeFieldGroup,
  SelectFieldGroup,
  TextStyleGroup,
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
  const [textDraft, setTextDraft] = useState(selectedText?.text ?? '');

  const fontStyle = selectedText?.fontStyle ?? textOptions.fontStyle;
  const fontSize = selectedText?.fontSize ?? textOptions.fontSize;
  const fontFamily = selectedText?.fontFamily ?? textOptions.fontFamily;
  const color = selectedText?.fill ?? textOptions.color;
  const isBold = fontStyle.includes('bold');
  const isItalic = fontStyle.includes('italic');

  useEffect(() => {
    setTextDraft(selectedText?.text ?? '');
  }, [selectedText?.id, selectedText?.text]);

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

  const previewTextContent = (text: string) => {
    if (!selectedText) {
      return;
    }

    dispatch({
      type: 'UPDATE_ANNOTATION',
      id: selectedText.id,
      updates: { text },
    });
  };

  const commitTextContent = (text: string) => {
    if (!selectedText) {
      return;
    }

    updateSelectedCommit({ text });
  };

  return (
    <>
      {selectedText && (
        <ControlCard label={locale.textContent}>
          <textarea
            data-testid="inkio-ie-text-content-input"
            className="inkio-ie-textarea"
            rows={3}
            value={textDraft}
            onChange={(event) => {
              const nextText = event.target.value;
              setTextDraft(nextText);
              previewTextContent(nextText);
            }}
            onBlur={(event) => {
              commitTextContent(event.target.value);
            }}
          />
        </ControlCard>
      )}

      <ColorSwatchGroup
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

      <SelectFieldGroup
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

      <RangeFieldGroup
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

      <TextStyleGroup
        label={selectedText ? locale.selectedText : locale.textDefaults}
        isBold={isBold}
        isItalic={isItalic}
        boldLabel={locale.bold}
        italicLabel={locale.italic}
        onToggleBold={() => updateFontStyle(!isBold, isItalic)}
        onToggleItalic={() => updateFontStyle(isBold, !isItalic)}
      />
      <LayerOrderControls annotationId={selectedText?.id ?? null} />
    </>
  );
}
