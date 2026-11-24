import { useImageEditor } from '../../hooks/use-image-editor';
import { PanelSection } from '../control-groups';
import { OptionPopover } from '../OptionPopover';

const LAYER_ACTIONS = [
  ['BRING_ANNOTATION_TO_FRONT', 'bringToFront', 'inkio-ie-layer-front', 'front'],
  ['BRING_ANNOTATION_FORWARD', 'bringForward', 'inkio-ie-layer-forward', 'front'],
  ['SEND_ANNOTATION_BACKWARD', 'sendBackward', 'inkio-ie-layer-backward', 'back'],
  ['SEND_ANNOTATION_TO_BACK', 'sendToBack', 'inkio-ie-layer-back', 'back'],
] as const;

interface LayerOrderControlsProps {
  annotationId: string | null;
}

export function LayerOrderControls({ annotationId }: LayerOrderControlsProps) {
  const { state, dispatch, locale } = useImageEditor();

  if (!annotationId) {
    return null;
  }

  const annotationIndex = state.annotations.findIndex((annotation) => annotation.id === annotationId);
  if (annotationIndex < 0) {
    return null;
  }

  const lastIndex = state.annotations.length - 1;

  return (
    <PanelSection label={locale.layerOrder}>
      <OptionPopover label={locale.layerOrder} testId="inkio-ie-layer-trigger">
        <div className="inkio-ie-layer-row" role="group" aria-label={locale.layerOrder}>
          {LAYER_ACTIONS.map(([type, label, testId, edge]) => (
            <button
              key={type}
              type="button"
              className="inkio-ie-chip"
              onClick={() => dispatch({ type, id: annotationId })}
              disabled={annotationIndex === (edge === 'front' ? lastIndex : 0)}
              data-testid={testId}
            >
              {locale[label]}
            </button>
          ))}
        </div>
      </OptionPopover>
    </PanelSection>
  );
}
