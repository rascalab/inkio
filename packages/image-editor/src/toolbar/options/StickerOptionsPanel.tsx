import { useImageEditor } from '../../hooks/use-image-editor';
import { STICKER_EMOJIS } from '../../constants';
import { PanelSection, ToolPanel } from '../control-groups';
import { LayerOrderControls } from './LayerOrderControls';

export function StickerOptionsPanel() {
  const { state, dispatch, locale } = useImageEditor();

  return (
    <ToolPanel title={locale.sticker ?? locale.emoji}>
      <PanelSection>
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
      </PanelSection>
      <LayerOrderControls annotationId={state.selectedAnnotationId} />
    </ToolPanel>
  );
}
