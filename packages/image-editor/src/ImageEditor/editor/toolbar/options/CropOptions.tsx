
import { useImageEditor } from '../../hooks/useImageEditor';
import { ASPECT_RATIO_PRESETS } from '../../constants';

export function CropOptions() {
  const { state, dispatch, locale } = useImageEditor();
  const { cropOptions, pendingCrop } = state;

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-label">{locale.crop}</div>
      <div className="inkio-ie-options-row inkio-ie-options-row--wrap">
        {ASPECT_RATIO_PRESETS.map((preset) => (
          <button
            key={preset.label ?? preset.labelKey}
            type="button"
            className={`inkio-ie-preset-btn${cropOptions.aspectRatio === preset.value ? ' is-active' : ''}`}
            onClick={() =>
              dispatch({ type: 'SET_CROP_OPTIONS', options: { aspectRatio: preset.value } })
            }
          >
            {preset.label ?? locale[preset.labelKey]}
          </button>
        ))}
      </div>

      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        <button
          type="button"
          className="inkio-ie-action-btn inkio-ie-action-btn--primary"
          disabled={!pendingCrop}
          onClick={() => dispatch({ type: 'APPLY_CROP' })}
        >
          {locale.apply}
        </button>
        <button
          type="button"
          className="inkio-ie-action-btn"
          onClick={() => {
            dispatch({ type: 'SET_PENDING_CROP', crop: null });
            dispatch({ type: 'RESET_CROP' });
          }}
        >
          {locale.reset}
        </button>
      </div>
    </div>
  );
};
