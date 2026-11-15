import { useImageEditor } from '../../hooks/use-image-editor';
import { STICKER_EMOJIS } from '../../constants';
import { PanelSection, ToolPanel } from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';
import { OptionPopover } from '../OptionPopover';

export function StickerOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();

  return (
    <ToolPanel title={locale.sticker ?? locale.emoji}>
      <PanelSection>
        <OptionPopover
          label={locale.sticker ?? locale.emoji}
          summary={<>{state.stickerOptions.emoji}<span>{locale.sticker ?? locale.emoji}</span></>}
          testId="inkio-ie-sticker-picker-trigger"
        >
        <div className="inkio-ie-emoji-grid" role="group" aria-label={locale.emoji}>
          {STICKER_EMOJIS.map((emoji) => {
            const active = state.stickerOptions.emoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                className={`inkio-ie-emoji-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => dispatch({ type: 'SET_STICKER_OPTIONS', options: { emoji } })}
                data-testid={`inkio-ie-sticker-${emoji.codePointAt(0)?.toString(16)}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        </OptionPopover>
      </PanelSection>
      <LayerOrderControls
        annotationId={
          state.annotations.some(
            (annotation) => annotation.id === state.selectedAnnotationId && annotation.type === 'sticker',
          )
            ? state.selectedAnnotationId
            : null
        }
      />
    </ToolPanel>
  );
}
