import { useImageEditor } from '../../hooks/use-image-editor';
import { isShapeAnnotation } from '../../utils/annotation-types';
import { ColorPickerButton } from '../ColorPickerButton';
import { PanelSection, SegmentedControl, SliderRow, ToolPanel } from '../control-groups';
import { optionFields, selectedFor } from './annotation-fields';
import { LayerOrderControls } from './LayerOrderControls';

const SHAPES = ['rect', 'ellipse', 'arrow', 'line'] as const;

export function ShapeOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { shapeOptions } = state;
  const selectedShape = selectedFor(state, isShapeAnnotation);
  const field = optionFields(dispatch, 'SET_SHAPE_OPTIONS', selectedShape);
  const canEditFill = !selectedShape || selectedShape.type === 'rect' || selectedShape.type === 'ellipse';
  const fill = selectedShape && 'fill' in selectedShape ? selectedShape.fill : shapeOptions.fill;
  const stroke = selectedShape?.stroke ?? shapeOptions.stroke;
  const strokeWidth = selectedShape?.strokeWidth ?? shapeOptions.strokeWidth;

  return (
    <ToolPanel title={selectedShape ? locale.selectedShape : locale.shapeDefaults}>
      {!selectedShape && (
        <PanelSection label={locale.shapes}>
          <SegmentedControl
            label={locale.shapes}
            items={SHAPES.map((type) => ({
              key: type,
              label: locale[type === 'rect' ? 'rectangle' : type],
              active: shapeOptions.shapeType === type,
              onClick: () => dispatch({ type: 'SET_SHAPE_OPTIONS', options: { shapeType: type } }),
              testId: `inkio-ie-shape-${type}`,
            }))}
          />
        </PanelSection>
      )}

      {canEditFill && (
        <PanelSection label={locale.fill}>
          <ColorPickerButton
            label={locale.fill}
            value={fill}
            locale={locale}
            testId="inkio-ie-shape-fill-picker"
            allowTransparent
            transparentLabel={`Color: ${locale.transparent}`}
            onChange={field('fill')}
          />
        </PanelSection>
      )}

      <PanelSection>
        <ColorPickerButton
          label={locale.stroke}
          value={stroke}
          locale={locale}
          testId="inkio-ie-shape-color-picker"
          allowTransparent
          transparentLabel={`${locale.stroke}: ${locale.transparent}`}
          transparentTestId="inkio-ie-shape-stroke-transparent"
          onChange={field('stroke')}
        />
        <SliderRow
          presentation="popover"
          label={locale.strokeWidth}
          valueLabel={String(strokeWidth)}
          min={1}
          max={20}
          value={strokeWidth}
          rangeTestId="inkio-ie-shape-stroke-width-range"
          numberTestId="inkio-ie-shape-stroke-width-number"
          onChange={field('strokeWidth')}
          commitOnRelease={!!selectedShape}
        />
      </PanelSection>
      <LayerOrderControls annotationId={selectedShape?.id ?? null} />
    </ToolPanel>
  );
}
