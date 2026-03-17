import { useImageEditor } from '../../hooks/use-image-editor';
import type { FreeDrawAnnotation } from '../../types';
import { COLOR_PRESETS } from '../../color-presets';
import { getSelectedAnnotation, isDrawAnnotation } from '../../utils/annotation-types';
import { ColorSwatchGroup, RangeFieldGroup } from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';

export function DrawOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const { drawOptions } = state;
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
    <>
      <ColorSwatchGroup
        label={locale.color}
        value={color}
        presets={COLOR_PRESETS}
        pickerTestId="inkio-ie-draw-color-picker"
        enableAlpha={false}
        hexLabel={locale.colorHex}
        alphaLabel={locale.colorAlpha}
        paletteLabel={locale.colorPalette}
        onChange={(nextColor) => {
          if (selectedDraw) {
            updateSelectedCommit({ stroke: nextColor });
            return;
          }

          dispatch({ type: 'SET_DRAW_OPTIONS', options: { color: nextColor } });
        }}
      />
      <RangeFieldGroup
        label={locale.brushSize}
        valueLabel={String(strokeWidth)}
        min={1}
        max={50}
        value={strokeWidth}
        rangeTestId="inkio-ie-draw-brush-size-range"
        numberTestId="inkio-ie-draw-brush-size-number"
        onPreviewChange={(nextStrokeWidth) => {
          if (selectedDraw) {
            updateSelectedPreview({ strokeWidth: nextStrokeWidth });
            return;
          }

          dispatch({
            type: 'SET_DRAW_OPTIONS',
            options: { strokeWidth: nextStrokeWidth },
          });
        }}
        onCommitChange={(nextStrokeWidth) => {
          if (!selectedDraw) {
            return;
          }

          updateSelectedCommit({ strokeWidth: nextStrokeWidth });
        }}
        onDirectChange={(nextStrokeWidth) => {
          if (selectedDraw) {
            updateSelectedCommit({ strokeWidth: nextStrokeWidth });
            return;
          }

          dispatch({
            type: 'SET_DRAW_OPTIONS',
            options: { strokeWidth: nextStrokeWidth },
          });
        }}
      />
      <RangeFieldGroup
        label={locale.opacity}
        valueLabel={`${Math.round(opacity * 100)}%`}
        min={0}
        max={1}
        step={0.05}
        value={opacity}
        rangeTestId="inkio-ie-draw-opacity-range"
        onPreviewChange={(nextOpacity) => {
          if (selectedDraw) {
            updateSelectedPreview({ opacity: nextOpacity });
            return;
          }

          dispatch({
            type: 'SET_DRAW_OPTIONS',
            options: { opacity: nextOpacity },
          });
        }}
        onCommitChange={(nextOpacity) => {
          if (!selectedDraw) {
            return;
          }

          updateSelectedCommit({ opacity: nextOpacity });
        }}
        onDirectChange={(nextOpacity) => {
          if (selectedDraw) {
            updateSelectedCommit({ opacity: nextOpacity });
            return;
          }

          dispatch({
            type: 'SET_DRAW_OPTIONS',
            options: { opacity: nextOpacity },
          });
        }}
      />
      <LayerOrderControls annotationId={selectedDraw?.id ?? null} />
    </>
  );
}
