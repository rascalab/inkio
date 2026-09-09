import { useImageEditor } from '../../hooks/use-image-editor';
import { STICKER_EMOJIS } from '../../constants';
import { PresetChipGroup } from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';

export function StickerOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();

  return (
    <>
      <PresetChipGroup
        label={locale.emoji}
        items={STICKER_EMOJIS.map((emoji) => ({
          key: emoji,
          label: emoji,
          active: state.stickerOptions.emoji === emoji,
          onClick: () => dispatch({ type: 'SET_STICKER_OPTIONS', options: { emoji } }),
          testId: `inkio-ie-sticker-${emoji.codePointAt(0)?.toString(16)}`,
        }))}
      />
      <LayerOrderControls annotationId={state.selectedAnnotationId} />
    </>
  );
}
