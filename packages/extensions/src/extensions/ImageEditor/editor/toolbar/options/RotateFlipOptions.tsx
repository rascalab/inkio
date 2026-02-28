
import { useImageEditor } from '../../hooks/useImageEditor';
import { RotateCWIcon, RotateCCWIcon, FlipHIcon, FlipVIcon } from '../../icons';

export function RotateFlipOptions() {
  const { dispatch, locale } = useImageEditor();

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-label">{locale.rotate}</div>
      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        <button
          type="button"
          className="inkio-ie-icon-btn"
          title={locale.rotateCW}
          onClick={() => dispatch({ type: 'ROTATE_CW' })}
        >
          <RotateCWIcon size={18} />
          <span>90°→</span>
        </button>
        <button
          type="button"
          className="inkio-ie-icon-btn"
          title={locale.rotateCCW}
          onClick={() => dispatch({ type: 'ROTATE_CCW' })}
        >
          <RotateCCWIcon size={18} />
          <span>90°←</span>
        </button>
      </div>

      <div className="inkio-ie-options-label inkio-ie-options-label--mt">{locale.flip}</div>
      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        <button
          type="button"
          className="inkio-ie-icon-btn"
          title={locale.flipH}
          onClick={() => dispatch({ type: 'FLIP_X' })}
        >
          <FlipHIcon size={18} />
          <span>↔</span>
        </button>
        <button
          type="button"
          className="inkio-ie-icon-btn"
          title={locale.flipV}
          onClick={() => dispatch({ type: 'FLIP_Y' })}
        >
          <FlipVIcon size={18} />
          <span>↕</span>
        </button>
      </div>
    </div>
  );
};
