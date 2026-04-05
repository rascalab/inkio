
import { Layer, Group } from 'react-konva';
import { ImageNode } from './ImageNode';
import { AnnotationRenderer } from '../annotations/AnnotationRenderer';
import type { ImageEditorState, Annotation } from '../types';
import { getBaseDisplayDimensions } from '../utils/geometry';

interface DesignLayerProps {
  state: ImageEditorState;
  displayWidth: number;
  displayHeight: number;
  onSelectAnnotation: (id: string) => void;
  onChangeAnnotation: (id: string, updates: Partial<Annotation>) => void;
}

export function DesignLayer({
  state,
  displayWidth,
  displayHeight,
  onSelectAnnotation,
  onChangeAnnotation,
}: DesignLayerProps) {
  if (!state.originalImage) return null;

  const cropX = state.transform.crop?.x ?? 0;
  const cropY = state.transform.crop?.y ?? 0;
  const srcW = state.transform.crop?.width ?? state.originalWidth;
  const srcH = state.transform.crop?.height ?? state.originalHeight;

  const rotation = state.transform.rotation ?? 0;
  const { width: baseDisplayWidth, height: baseDisplayHeight } = getBaseDisplayDimensions(
    displayWidth, displayHeight, rotation,
  );
  const annScale = baseDisplayWidth > 0 && srcW > 0 ? Math.min(baseDisplayWidth / srcW, baseDisplayHeight / srcH) : 1;

  const flipX = state.transform.flipX ? -1 : 1;
  const flipY = state.transform.flipY ? -1 : 1;

  return (
    <Layer>
      <ImageNode
        image={state.originalImage}
        displayWidth={displayWidth}
        displayHeight={displayHeight}
        transform={state.transform}
      />
      <Group
        x={displayWidth / 2}
        y={displayHeight / 2}
        rotation={rotation}
        scaleX={flipX}
        scaleY={flipY}
        offsetX={baseDisplayWidth / 2}
        offsetY={baseDisplayHeight / 2}
      >
        <Group
          x={-cropX * annScale}
          y={-cropY * annScale}
        >
          {state.annotations.map((ann) => (
            <AnnotationRenderer
              key={ann.id}
              annotation={ann}
              onSelect={onSelectAnnotation}
              onChange={onChangeAnnotation}
              scale={annScale}
            />
          ))}
        </Group>
      </Group>
    </Layer>
  );
};
