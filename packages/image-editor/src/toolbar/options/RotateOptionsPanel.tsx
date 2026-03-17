import { useImageEditor } from '../../hooks/use-image-editor';
import { FlipHIcon, FlipVIcon, RotateCCWIcon, RotateCWIcon } from '../../icons';
import { RotateActionGroup } from '../control-groups';

export function RotateOptionsPanel() {
  const { dispatch, locale } = useImageEditor();

  return (
    <RotateActionGroup
      label={locale.rotate}
      actions={[
        {
          key: 'rotate-ccw',
          label: locale.rotateCCW,
          icon: <RotateCCWIcon size={18} />,
          testId: 'inkio-ie-rotate-ccw',
          onClick: () => dispatch({ type: 'ROTATE_CCW' }),
        },
        {
          key: 'rotate-cw',
          label: locale.rotateCW,
          icon: <RotateCWIcon size={18} />,
          testId: 'inkio-ie-rotate-cw',
          onClick: () => dispatch({ type: 'ROTATE_CW' }),
        },
        {
          key: 'flip-horizontal',
          label: locale.flipH,
          icon: <FlipHIcon size={18} />,
          testId: 'inkio-ie-flip-horizontal',
          onClick: () => dispatch({ type: 'FLIP_X' }),
        },
        {
          key: 'flip-vertical',
          label: locale.flipV,
          icon: <FlipVIcon size={18} />,
          testId: 'inkio-ie-flip-vertical',
          onClick: () => dispatch({ type: 'FLIP_Y' }),
        },
      ]}
    />
  );
}
