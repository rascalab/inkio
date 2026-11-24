import { useImageEditor } from '../../hooks/use-image-editor';
import { FlipHIcon, FlipVIcon, RotateCCWIcon, RotateCWIcon } from '../../icons';
import { PanelSection, ToolPanel } from '../control-groups';

const TRANSFORM_ACTIONS = [
  ['ROTATE_CCW', 'rotateCCW', RotateCCWIcon, 'inkio-ie-rotate-ccw'],
  ['ROTATE_CW', 'rotateCW', RotateCWIcon, 'inkio-ie-rotate-cw'],
  ['FLIP_X', 'flipH', FlipHIcon, 'inkio-ie-flip-horizontal'],
  ['FLIP_Y', 'flipV', FlipVIcon, 'inkio-ie-flip-vertical'],
] as const;

export function RotateOptionsPanel() {
  const { dispatch, locale } = useImageEditor();

  return (
    <ToolPanel title={locale.rotate}>
      <PanelSection>
        <div className="inkio-ie-icon-action-row" role="group" aria-label={locale.rotate}>
          {TRANSFORM_ACTIONS.map(([type, label, Icon, testId]) => (
            <button
              key={type}
              type="button"
              className="inkio-ie-icon-action-btn"
              title={locale[label]}
              aria-label={locale[label]}
              data-testid={testId}
              onClick={() => dispatch({ type })}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      </PanelSection>
    </ToolPanel>
  );
}
