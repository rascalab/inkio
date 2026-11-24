import { useImageEditor } from '../../hooks/use-image-editor';
import { isDrawAnnotation } from '../../utils/annotation-types';
import { ColorPickerButton } from '../ColorPickerButton';
import { PanelSection, SliderRow, ToolPanel } from '../control-groups';
import { optionFields, selectedFor } from './annotation-fields';
import { LayerOrderControls } from './LayerOrderControls';

export function DrawOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { drawOptions } = state;
  const selectedDraw = selectedFor(state, isDrawAnnotation);
  const field = optionFields(dispatch, 'SET_DRAW_OPTIONS', selectedDraw);

  const color = selectedDraw?.stroke ?? drawOptions.color;
  const strokeWidth = selectedDraw?.strokeWidth ?? drawOptions.strokeWidth;
  const opacity = selectedDraw?.opacity ?? drawOptions.opacity;

  return (
    <ToolPanel title={selectedDraw ? locale.selectedDraw : locale.drawDefaults}>
      <PanelSection label={locale.color}>
        <ColorPickerButton
          label={locale.color}
          value={color}
          locale={locale}
          testId="inkio-ie-draw-color-picker"
          enableAlpha={false}
          onChange={field('color', 'stroke')}
        />
      </PanelSection>
      <PanelSection>
        <SliderRow
          presentation="popover"
          label={locale.brushSize}
          valueLabel={String(strokeWidth)}
          min={1}
          max={50}
          value={strokeWidth}
          rangeTestId="inkio-ie-draw-brush-size-range"
          numberTestId="inkio-ie-draw-brush-size-number"
          onChange={field('strokeWidth')}
          commitOnRelease={!!selectedDraw}
        />
        <SliderRow
          presentation="popover"
          label={locale.opacity}
          valueLabel={`${Math.round(opacity * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          rangeTestId="inkio-ie-draw-opacity-range"
          onChange={field('opacity')}
          commitOnRelease={!!selectedDraw}
        />
      </PanelSection>
      <LayerOrderControls annotationId={selectedDraw?.id ?? null} />
    </ToolPanel>
  );
}
