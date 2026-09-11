import { useImageEditor } from '../../hooks/use-image-editor';
import type { RedactAnnotation, RedactMode } from '../../types';
import { getSelectedAnnotation, isRedactAnnotation } from '../../utils/annotation-types';
import { PanelSection, SegmentedControl, SliderRow, ToolPanel } from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';

export function RedactOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  const selectedRedact = isRedactAnnotation(selectedAnnotation) ? selectedAnnotation : null;

  const mode = selectedRedact?.mode ?? state.redactOptions.mode;
  const strength = selectedRedact?.strength ?? state.redactOptions.strength;

  const applyMode = (nextMode: RedactMode) => {
    if (selectedRedact) {
      dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id: selectedRedact.id, updates: { mode: nextMode } satisfies Partial<RedactAnnotation> });
      return;
    }
    dispatch({ type: 'SET_REDACT_OPTIONS', options: { mode: nextMode } });
  };

  const applyStrength = (nextStrength: number, commit: boolean) => {
    if (selectedRedact) {
      dispatch({
        type: commit ? 'UPDATE_ANNOTATION_COMMIT' : 'UPDATE_ANNOTATION',
        id: selectedRedact.id,
        updates: { strength: nextStrength } satisfies Partial<RedactAnnotation>,
      });
      return;
    }
    dispatch({ type: 'SET_REDACT_OPTIONS', options: { strength: nextStrength } });
  };

  return (
    <ToolPanel title={locale.redact}>
      <PanelSection>
        <SegmentedControl
          label={locale.redact}
          items={[
            {
              key: 'pixelate',
              label: locale.pixelate,
              active: mode === 'pixelate',
              onClick: () => applyMode('pixelate'),
              testId: 'inkio-ie-redact-mode-pixelate',
            },
            {
              key: 'blur',
              label: locale.blur,
              active: mode === 'blur',
              onClick: () => applyMode('blur'),
              testId: 'inkio-ie-redact-mode-blur',
            },
          ]}
        />
      </PanelSection>
      <PanelSection label={locale.strength}>
        <SliderRow
          label={locale.strength}
          valueLabel={String(Math.round(strength))}
          min={2}
          max={24}
          step={1}
          value={strength}
          onPreviewChange={(value) => applyStrength(value, false)}
          onCommitChange={(value) => applyStrength(value, true)}
          onDirectChange={(value) => applyStrength(value, true)}
          rangeTestId="inkio-ie-redact-strength-range"
          numberTestId="inkio-ie-redact-strength-number"
        />
      </PanelSection>
      <LayerOrderControls annotationId={selectedRedact?.id ?? null} />
    </ToolPanel>
  );
}
