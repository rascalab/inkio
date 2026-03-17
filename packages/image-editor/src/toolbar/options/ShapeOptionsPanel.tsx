import { useMemo } from 'react';
import { useImageEditor } from '../../hooks/use-image-editor';
import { COLOR_PRESETS } from '../../color-presets';
import type { ShapeType } from '../../types';
import { getSelectedAnnotation, isShapeAnnotation, type ShapeAnnotation } from '../../utils/annotation-types';
import { ColorSwatchGroup, PresetChipGroup, RangeFieldGroup } from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';

interface ShapeButton {
  type: ShapeType;
  label: string;
}

export function ShapeOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { shapeOptions } = state;
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  const selectedShape = isShapeAnnotation(selectedAnnotation) ? selectedAnnotation : null;
  const canEditFill = !selectedShape || selectedShape.type === 'rect' || selectedShape.type === 'ellipse';
  const currentShapeType = selectedShape?.type ?? shapeOptions.shapeType;
  const fill = selectedShape && 'fill' in selectedShape ? selectedShape.fill : shapeOptions.fill;
  const stroke = selectedShape?.stroke ?? shapeOptions.stroke;
  const strokeWidth = selectedShape?.strokeWidth ?? shapeOptions.strokeWidth;

  const shapeButtons = useMemo<ShapeButton[]>(
    () => [
      { type: 'rect', label: locale.rectangle },
      { type: 'ellipse', label: locale.ellipse },
      { type: 'arrow', label: locale.arrow },
      { type: 'line', label: locale.line },
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
    <>
      {!selectedShape && (
        <PresetChipGroup
          label={locale.shapes}
          items={shapeButtons.map(({ type, label }) => ({
            key: type,
            label,
            active: currentShapeType === type,
            onClick: () => dispatch({ type: 'SET_SHAPE_OPTIONS', options: { shapeType: type } }),
            testId: undefined,
          }))}
        />
      )}

      {canEditFill && (
        <ColorSwatchGroup
          label={locale.fill}
          value={fill}
          presets={COLOR_PRESETS}
          pickerTestId="inkio-ie-shape-fill-picker"
          allowTransparent
          transparentLabel="Color: transparent"
          enableAlpha
          hexLabel={locale.colorHex}
          alphaLabel={locale.colorAlpha}
          paletteLabel={locale.colorPalette}
          onChange={(nextColor) => {
            if (selectedShape) {
              updateSelectedCommit({ fill: nextColor });
              return;
            }

            dispatch({ type: 'SET_SHAPE_OPTIONS', options: { fill: nextColor } });
          }}
        />
      )}

      <ColorSwatchGroup
        label={locale.stroke}
        value={stroke}
        presets={COLOR_PRESETS}
        pickerTestId="inkio-ie-shape-color-picker"
        allowTransparent
        enableAlpha
        transparentLabel={`${locale.stroke}: ${locale.transparent}`}
        transparentTestId="inkio-ie-shape-stroke-transparent"
        hexLabel={locale.colorHex}
        alphaLabel={locale.colorAlpha}
        paletteLabel={locale.colorPalette}
        onChange={(nextColor) => {
          if (selectedShape) {
            updateSelectedCommit({ stroke: nextColor });
            return;
          }

          dispatch({ type: 'SET_SHAPE_OPTIONS', options: { stroke: nextColor } });
        }}
      />

      <RangeFieldGroup
        label={locale.stroke}
        valueLabel={String(strokeWidth)}
        min={1}
        max={20}
        value={strokeWidth}
        rangeTestId="inkio-ie-shape-stroke-width-range"
        numberTestId="inkio-ie-shape-stroke-width-number"
        onPreviewChange={(nextStrokeWidth) => {
          if (selectedShape) {
            updateSelectedPreview({ strokeWidth: nextStrokeWidth });
            return;
          }

          dispatch({
            type: 'SET_SHAPE_OPTIONS',
            options: { strokeWidth: nextStrokeWidth },
          });
        }}
        onCommitChange={(nextStrokeWidth) => {
          if (!selectedShape) {
            return;
          }

          updateSelectedCommit({ strokeWidth: nextStrokeWidth });
        }}
        onDirectChange={(nextStrokeWidth) => {
          if (selectedShape) {
            updateSelectedCommit({ strokeWidth: nextStrokeWidth });
            return;
          }

          dispatch({
            type: 'SET_SHAPE_OPTIONS',
            options: { strokeWidth: nextStrokeWidth },
          });
        }}
      />
      <LayerOrderControls annotationId={selectedShape?.id ?? null} />
    </>
  );
}
