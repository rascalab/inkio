import { useImageEditor } from '../../hooks/use-image-editor';
import { isTextAnnotation } from '../../utils/annotation-types';
import { ColorPickerButton } from '../ColorPickerButton';
import {
  PanelSection,
  SelectField,
  SliderRow,
  TextStyleRow,
  ToolPanel,
} from '../control-groups';
import { optionFields, selectedFor } from './annotation-fields';
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
  const selectedText = selectedFor(state, isTextAnnotation);
  const field = optionFields(dispatch, 'SET_TEXT_OPTIONS', selectedText);
  const setFontStyle = field('fontStyle');
  const setFontFamily = field('fontFamily');

  const fontStyle = selectedText?.fontStyle ?? textOptions.fontStyle;
  const fontSize = selectedText?.fontSize ?? textOptions.fontSize;
  const fontFamily = selectedText?.fontFamily ?? textOptions.fontFamily;
  const color = selectedText?.fill ?? textOptions.color;
  const isBold = fontStyle.includes('bold');
  const isItalic = fontStyle.includes('italic');

  const updateFontStyle = (bold: boolean, italic: boolean) => {
    let style: 'normal' | 'bold' | 'italic' | 'bold italic' = 'normal';
    if (bold && italic) style = 'bold italic';
    else if (bold) style = 'bold';
    else if (italic) style = 'italic';

    setFontStyle(style);
  };

  return (
    <ToolPanel title={selectedText ? locale.selectedText : locale.textDefaults}>
      <PanelSection label={locale.color}>
        <ColorPickerButton
          label={locale.color}
          value={color}
          locale={locale}
          testId="inkio-ie-text-color-picker"
          onChange={field('color', 'fill')}
        />
      </PanelSection>

      <PanelSection>
        <SelectField
          label={locale.fontFamily}
          value={fontFamily}
          options={FONT_FAMILY_OPTIONS}
          testId="inkio-ie-font-family-input"
          onChange={(nextFamily) => setFontFamily(nextFamily || 'system-ui')}
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
              onChange={field('fontSize')}
              commitOnRelease={!!selectedText}
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
