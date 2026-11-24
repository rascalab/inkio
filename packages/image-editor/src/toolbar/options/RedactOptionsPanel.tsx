import { useImageEditor } from '../../hooks/use-image-editor';
import { isRedactAnnotation } from '../../utils/annotation-types';
import { PanelSection, SegmentedControl, SliderRow, ToolPanel } from '../control-groups';
import { optionFields, selectedFor } from './annotation-fields';
import { LayerOrderControls } from './LayerOrderControls';

export function RedactOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();
  const selectedRedact = selectedFor(state, isRedactAnnotation);
  const field = optionFields(dispatch, 'SET_REDACT_OPTIONS', selectedRedact);
  const applyMode = field('mode');

  const mode = selectedRedact?.mode ?? state.redactOptions.mode;
  const strength = selectedRedact?.strength ?? state.redactOptions.strength;

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
          presentation="popover"
          label={locale.strength}
          valueLabel={String(Math.round(strength))}
          min={2}
          max={24}
          step={1}
          value={strength}
          onChange={field('strength')}
          commitOnRelease
          rangeTestId="inkio-ie-redact-strength-range"
          numberTestId="inkio-ie-redact-strength-number"
        />
      </PanelSection>
      <LayerOrderControls annotationId={selectedRedact?.id ?? null} />
    </ToolPanel>
  );
}
