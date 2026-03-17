import { useImageEditor } from '../../hooks/use-image-editor';
import { LayerOrderGroup } from '../control-groups';

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
    <LayerOrderGroup
      label={locale.layerOrder}
      items={[
        {
          key: 'front',
          label: locale.bringToFront,
          testId: 'inkio-ie-layer-front',
          disabled: annotationIndex === lastIndex,
          onClick: () => dispatch({ type: 'BRING_ANNOTATION_TO_FRONT', id: annotationId }),
        },
        {
          key: 'forward',
          label: locale.bringForward,
          testId: 'inkio-ie-layer-forward',
          disabled: annotationIndex >= lastIndex,
          onClick: () => dispatch({ type: 'BRING_ANNOTATION_FORWARD', id: annotationId }),
        },
        {
          key: 'backward',
          label: locale.sendBackward,
          testId: 'inkio-ie-layer-backward',
          disabled: annotationIndex <= 0,
          onClick: () => dispatch({ type: 'SEND_ANNOTATION_BACKWARD', id: annotationId }),
        },
        {
          key: 'back',
          label: locale.sendToBack,
          testId: 'inkio-ie-layer-back',
          disabled: annotationIndex === 0,
          onClick: () => dispatch({ type: 'SEND_ANNOTATION_TO_BACK', id: annotationId }),
        },
      ]}
    />
  );
}
