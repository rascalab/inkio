import { useImageEditor } from '../../hooks/use-image-editor';
import type { FinetuneOptions } from '../../types';
import { PanelPrimaryButton, PanelSection, SliderRow, ToolPanel } from '../control-groups';
import { FilterThumbnails } from './FilterThumbnails';

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function FilterOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();

  const setFinetune = (finetune: Partial<FinetuneOptions>) => {
    dispatch({ type: 'SET_FINETUNE', finetune });
  };

  return (
    <ToolPanel
      title={locale.filter}
      actions={(
        <PanelPrimaryButton
          label={locale.resetFinetune}
          testId="inkio-ie-finetune-reset"
          onClick={() => dispatch({ type: 'RESET_FINETUNE' })}
        />
      )}
    >
      <PanelSection>
        <FilterThumbnails />
      </PanelSection>
      <PanelSection label={locale.finetune}>
        <div className="inkio-ie-slider-grid">
          <SliderRow
            label={locale.brightness}
            valueLabel={formatSigned(state.finetune.brightness)}
            min={-1}
            max={1}
            step={0.01}
            value={state.finetune.brightness}
            onPreviewChange={(brightness) => setFinetune({ brightness })}
            onDirectChange={(brightness) => setFinetune({ brightness })}
            rangeTestId="inkio-ie-finetune-brightness-range"
            numberTestId="inkio-ie-finetune-brightness-number"
          />
          <SliderRow
            label={locale.contrast}
            valueLabel={formatSigned(state.finetune.contrast)}
            min={-100}
            max={100}
            step={1}
            value={state.finetune.contrast}
            onPreviewChange={(contrast) => setFinetune({ contrast })}
            onDirectChange={(contrast) => setFinetune({ contrast })}
            rangeTestId="inkio-ie-finetune-contrast-range"
            numberTestId="inkio-ie-finetune-contrast-number"
          />
          <SliderRow
            label={locale.saturation}
            valueLabel={formatSigned(state.finetune.saturation)}
            min={-1}
            max={1}
            step={0.01}
            value={state.finetune.saturation}
            onPreviewChange={(saturation) => setFinetune({ saturation })}
            onDirectChange={(saturation) => setFinetune({ saturation })}
            rangeTestId="inkio-ie-finetune-saturation-range"
            numberTestId="inkio-ie-finetune-saturation-number"
          />
          <SliderRow
            label={locale.clarity}
            valueLabel={formatSigned(state.finetune.clarity)}
            min={-1}
            max={1}
            step={0.01}
            value={state.finetune.clarity}
            onPreviewChange={(clarity) => setFinetune({ clarity })}
            onDirectChange={(clarity) => setFinetune({ clarity })}
            rangeTestId="inkio-ie-finetune-clarity-range"
            numberTestId="inkio-ie-finetune-clarity-number"
          />
        </div>
      </PanelSection>
    </ToolPanel>
  );
}
