import { useRef } from 'react';
import type Konva from 'konva';
import type { Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';
import { applyPointTransform } from '../utils/point-transform';

export interface AnnotationShapeProps<A extends Annotation> {
  annotation: A;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

/**
 * Reads the node's transform after a Transformer gesture, resets whatever it
 * baked into the geometry, and returns the image-space updates to commit
 * (or null to skip the commit).
 */
export type TransformUpdatesReader<N extends Konva.Node> = (node: N) => Partial<Annotation> | null;

/**
 * Shared Konva props for annotation shapes: selection, hover cursor, drag
 * commit and transform commit. Box-like annotations commit their dragged
 * x/y; point-based annotations (arrow/line/freedraw) keep the node at the
 * origin and translate their points instead. Geometry is stored in image
 * space, so display offsets are divided by `scale`.
 */
export function useAnnotationShapeHandlers<N extends Konva.Node>(
  { annotation, onSelect, onChange, scale }: AnnotationShapeProps<Annotation>,
  readTransformUpdates: TransformUpdatesReader<N>,
) {
  const ref = useRef<N>(null);
  const select = () => onSelect(annotation.id);

  return {
    ref,
    id: annotation.id,
    draggable: true,
    onClick: select,
    onTap: select,
    onMouseEnter: handleCursorPointer,
    onMouseLeave: handleCursorDefault,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      if ('points' in annotation) {
        const node = ref.current;
        if (!node) return;
        const dx = e.target.x();
        const dy = e.target.y();
        node.x(0);
        node.y(0);
        onChange(annotation.id, {
          points: annotation.points.map((p, i) =>
            i % 2 === 0 ? p + dx / scale : p + dy / scale,
          ),
        });
        return;
      }
      // Stage size is zero before first layout: dividing by a zero scale
      // would persist Infinity/NaN positions.
      if (!Number.isFinite(scale) || scale <= 0) return;
      onChange(annotation.id, {
        x: e.target.x() / scale,
        y: e.target.y() / scale,
      });
    },
    onTransformEnd: () => {
      const node = ref.current;
      if (!node) return;
      const updates = readTransformUpdates(node);
      if (updates) onChange(annotation.id, updates);
    },
  };
}

/** Transform reader for point-based annotations (arrow, line, freedraw). */
export function readPointsTransform(points: number[], scale: number): TransformUpdatesReader<Konva.Node> {
  return (node) => {
    const nextPoints = applyPointTransform(
      points,
      {
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      },
      scale,
    );

    node.x(0);
    node.y(0);
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(0);

    return { points: nextPoints };
  };
}
