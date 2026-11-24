import { useImageEditor } from '../../hooks/use-image-editor';
import { PanelPrimaryButton, PanelSection, SliderRow, ToolPanel } from '../control-groups';
import { FilterThumbnails } from './FilterThumbnails';
import { OptionPopover } from '../OptionPopover';

const FINETUNE_FIELDS = ['brightness', 'contrast', 'saturation', 'clarity'] as const;

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function FilterOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();

  return (
    <ToolPanel title={locale.filter}>
      <PanelSection>
        <FilterThumbnails />
      </PanelSection>
      <PanelSection label={locale.finetune}>
        <OptionPopover label={locale.finetune} testId="inkio-ie-finetune-trigger">
          <div className="inkio-ie-slider-grid">
            {FINETUNE_FIELDS.map((field) => {
              const value = state.finetune[field];
              const limit = field === 'contrast' ? 100 : 1;
              const testId = `inkio-ie-finetune-${field}`;
              return (
                <SliderRow
                  key={field}
                  label={locale[field]}
                  valueLabel={formatSigned(value)}
                  min={-limit}
                  max={limit}
                  step={limit / 100}
                  value={value}
                  onChange={(next) => dispatch({ type: 'SET_FINETUNE', finetune: { [field]: next } })}
                  rangeTestId={`${testId}-range`}
                  numberTestId={`${testId}-number`}
                />
              );
            })}
          </div>
          <PanelPrimaryButton
            label={locale.resetFinetune}
            testId="inkio-ie-finetune-reset"
            onClick={() => dispatch({ type: 'RESET_FINETUNE' })}
          />
        </OptionPopover>
      </PanelSection>
    </ToolPanel>
  );
}
