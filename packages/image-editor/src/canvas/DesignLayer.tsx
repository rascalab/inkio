
import { memo, useMemo, type ReactNode } from 'react';
import { Layer, Group, Shape } from 'react-konva/lib/ReactKonvaCore.js';
import { AnnotationRenderer } from '../annotations/AnnotationRenderer';
import type { ImageEditorState, Annotation, CropRect, Transform } from '../types';
import { getAnnotationScale, getBaseDisplayDimensions } from '../utils/geometry';
import { getAnnotationDisplayBounds, isDisplayBoundsOutsideViewport } from '../utils/annotation-bounds';

interface DesignLayerProps {
  state: ImageEditorState;
  // Effective transform for this render: the crop-nulled session transform
  // in crop mode (full original on screen), the applied transform otherwise.
  transform: Transform;
  displayWidth: number;
  displayHeight: number;
  interactive: boolean;
  children?: ReactNode;
  onSelectAnnotation: (id: string) => void;
  onChangeAnnotation: (id: string, updates: Partial<Annotation>) => void;
  editingTextId?: string;
  cropAperture?: CropRect;
  onEditText?: (id: string) => void;
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
  interactive,
  children,
  onChangeAnnotation,
  editingTextId,
  cropAperture,
  onEditText,
}: DesignLayerProps) {
  const cropX = transform.crop?.x ?? 0;
  const cropY = transform.crop?.y ?? 0;
  const rotation = transform.rotation ?? 0;
  const { width: baseDisplayWidth, height: baseDisplayHeight } = getBaseDisplayDimensions(
    displayWidth, displayHeight, rotation,
  );
  const annotationScale = getAnnotationScale(
    transform,
    state.originalWidth,
    state.originalHeight,
    displayWidth,
    displayHeight,
  );
  const annScale = annotationScale.x;

  const flipX = transform.flipX ? -1 : 1;
  const flipY = transform.flipY ? -1 : 1;

  // Viewport culling: fully offscreen annotations stay mounted (selection +
  // Transformer keep working — Konva skips drawing invisible subtrees) but
  // are hidden via `visible={false}`. Box shapes have O(1) bounds; point
  // clouds (freedraw/line/arrow) would need an O(n) scan per render, so they
  // always render. The selected annotation is never culled.
  const hidden = useMemo(() => {
    const ids = new Set<string>();
    for (const ann of state.annotations) {
      if (ann.id === state.selectedAnnotationId || 'points' in ann) continue;
      const bounds = getAnnotationDisplayBounds(ann, {
        annotationScale: annScale,
        annotationScaleY: annotationScale.y,
        cropX,
        cropY,
        displayWidth,
        displayHeight,
        originalWidth: state.originalWidth,
        originalHeight: state.originalHeight,
        rotation,
        flipX: transform.flipX,
        flipY: transform.flipY,
      });
      if (isDisplayBoundsOutsideViewport(bounds, displayWidth, displayHeight, CULL_MARGIN)) ids.add(ann.id);
    }
    return ids;
  }, [
    state.annotations,
    state.selectedAnnotationId,
    state.originalWidth,
    state.originalHeight,
    transform.flipX,
    transform.flipY,
    annScale,
    annotationScale.y,
    cropX,
    cropY,
    displayWidth,
    displayHeight,
    rotation,
  ]);

  if (!state.originalImage) return null;

  return (
    <Layer listening={interactive}>
      {children}
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
          y={-cropY * annotationScale.y}
          scaleY={annotationScale.y / annScale}
        >
          {state.annotations.map((ann) => (
            <Group key={ann.id} visible={!hidden.has(ann.id)}>
              <MemoizedAnnotationRenderer
                annotation={ann}
                image={state.originalImage}
                onSelect={onSelectAnnotation}
                onChange={onChangeAnnotation}
                scale={annScale}
                editingTextId={editingTextId}
                onEditText={onEditText}
              />
            </Group>
          ))}
        </Group>
      </Group>
      {cropAperture && (
        <Shape
          listening={false}
          fill="rgba(0, 0, 0, 0.58)"
          globalCompositeOperation="source-atop"
          sceneFunc={(context, shape) => {
            const { x, y, width, height } = cropAperture;
            // Reverse the aperture winding to cut it out of the raster mask.
            // Source-atop dims the painted pixels without adding alpha.
            context.beginPath();
            context.rect(0, 0, displayWidth, displayHeight);
            context.moveTo(x, y);
            context.lineTo(x, y + height);
            context.lineTo(x + width, y + height);
            context.lineTo(x + width, y);
            context.closePath();
            context.fillShape(shape);
          }}
        />
      )}
    </Layer>
  );
}

export const DesignLayer = memo(DesignLayerInner);
