
import { Layer, Group } from 'react-konva';
import { ImageNode } from './ImageNode';
import { AnnotationRenderer } from '../annotations/AnnotationRenderer';
import type { ImageEditorState, Annotation } from '../types';
import { getTransformedDimensions } from '../utils/geometry';

interface DesignLayerProps {
  state: ImageEditorState;
  displayWidth: number;
  displayHeight: number;
  scale: number;
  onSelectAnnotation: (id: string) => void;
  onStartTextEdit: (id: string) => void;
  onChangeAnnotation: (id: string, updates: Partial<Annotation>) => void;
}

export function DesignLayer({
  state,
  displayWidth,
  displayHeight,
  scale,
  onSelectAnnotation,
  onStartTextEdit,
  onChangeAnnotation,
}: DesignLayerProps) {
  if (!state.originalImage) return null;

  const { width: imgW, height: imgH } = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );

  const cropX = state.transform.crop?.x ?? 0;
  const cropY = state.transform.crop?.y ?? 0;
  const srcW = state.transform.crop?.width ?? state.originalWidth;
  const srcH = state.transform.crop?.height ?? state.originalHeight;
  const annScale = imgW > 0 && srcW > 0 ? Math.min(imgW / srcW, imgH / srcH) * scale : scale;

  const rotation = state.transform.rotation ?? 0;
  const flipX = state.transform.flipX ? -1 : 1;
  const flipY = state.transform.flipY ? -1 : 1;

  return (
    <Layer>
      <ImageNode
        image={state.originalImage}
        originalWidth={state.originalWidth}
        originalHeight={state.originalHeight}
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
        offsetX={displayWidth / 2}
        offsetY={displayHeight / 2}
      >
        <Group
          x={-cropX * annScale}
          y={-cropY * annScale}
        >
          {state.annotations.map((ann) => (
            <AnnotationRenderer
              key={ann.id}
              annotation={ann}
              isSelected={state.selectedAnnotationId === ann.id}
              onSelect={onSelectAnnotation}
              onStartTextEdit={onStartTextEdit}
              onChange={onChangeAnnotation}
              editingTextId={state.editingTextId}
              scale={annScale}
            />
          ))}
        </Group>
      </Group>
    </Layer>
  );
};
