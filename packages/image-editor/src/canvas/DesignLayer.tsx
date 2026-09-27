
import { memo, useMemo } from 'react';
import { Layer, Group } from 'react-konva';
import { ImageNode } from './ImageNode';
import { AnnotationRenderer } from '../annotations/AnnotationRenderer';
import type { ImageEditorState, Annotation, Transform } from '../types';
import { getAnnotationScale, getBaseDisplayDimensions } from '../utils/geometry';
import { getAnnotationDisplayBounds, isDisplayBoundsOutsideViewport } from '../utils/annotation-bounds';

interface DesignLayerProps {
  state: ImageEditorState;
  // Effective transform for this render: the crop-nulled session transform
  // in crop mode (full original on screen), the applied transform otherwise.
  transform: Transform;
  displayWidth: number;
  displayHeight: number;
  onSelectAnnotation: (id: string) => void;
  onChangeAnnotation: (id: string, updates: Partial<Annotation>) => void;
}

const MemoizedAnnotationRenderer = memo(AnnotationRenderer);

/** Margin so culled nodes pop back in before scrolling/zoom reveals them. */
const CULL_MARGIN = 64;

function DesignLayerInner({
  state,
  transform,
  displayWidth,
  displayHeight,
  onSelectAnnotation,
  onChangeAnnotation,
}: DesignLayerProps) {
  const cropX = transform.crop?.x ?? 0;
  const cropY = transform.crop?.y ?? 0;
  const rotation = transform.rotation ?? 0;
  const { width: baseDisplayWidth, height: baseDisplayHeight } = getBaseDisplayDimensions(
    displayWidth, displayHeight, rotation,
  );
  const annScale = getAnnotationScale(
    transform,
    state.originalWidth,
    state.originalHeight,
    displayWidth,
    displayHeight,
  );

  const flipX = transform.flipX ? -1 : 1;
  const flipY = transform.flipY ? -1 : 1;

  // Viewport culling: fully offscreen annotations stay mounted (selection +
  // Transformer keep working — Konva skips drawing invisible subtrees) but
  // are hidden via `visible={false}`. Box shapes have O(1) bounds; point
  // clouds (freedraw/line/arrow) would need an O(n) scan per render, so they
  // always render. The selected annotation is never culled.
  const visibility = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const ann of state.annotations) {
      if (ann.id === state.selectedAnnotationId) {
        map.set(ann.id, true);
        continue;
      }
      if (ann.type === 'freedraw' || ann.type === 'line' || ann.type === 'arrow') {
        map.set(ann.id, true);
        continue;
      }
      const bounds = getAnnotationDisplayBounds(ann, {
        annotationScale: annScale,
        cropX,
        cropY,
        displayWidth,
        displayHeight,
        originalWidth: state.originalWidth,
        originalHeight: state.originalHeight,
        rotation,
        flipX: state.transform.flipX,
        flipY: state.transform.flipY,
      });
      map.set(
        ann.id,
        !isDisplayBoundsOutsideViewport(bounds, displayWidth, displayHeight, CULL_MARGIN),
      );
    }
    return map;
  }, [
    state.annotations,
    state.selectedAnnotationId,
    state.originalWidth,
    state.originalHeight,
    transform.flipX,
    transform.flipY,
    annScale,
    cropX,
    cropY,
    displayWidth,
    displayHeight,
    rotation,
  ]);

  if (!state.originalImage) return null;

  return (
    <Layer>
      <ImageNode
        image={state.originalImage}
        displayWidth={displayWidth}
        displayHeight={displayHeight}
        transform={transform}
        filter={state.filter}
        finetune={state.finetune}
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
            <Group key={ann.id} visible={visibility.get(ann.id) !== false}>
              <MemoizedAnnotationRenderer
                annotation={ann}
                image={state.originalImage}
                onSelect={onSelectAnnotation}
                onChange={onChangeAnnotation}
                scale={annScale}
              />
            </Group>
          ))}
        </Group>
      </Group>
    </Layer>
  );
}

export const DesignLayer = memo(DesignLayerInner);
