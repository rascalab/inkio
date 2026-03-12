import { useRef } from 'react';
import { Ellipse } from 'react-konva';
import type Konva from 'konva';
import type { EllipseAnnotation, Annotation } from '../types';
import { getIEColors, handleCursorPointer, handleCursorDefault } from '../theme';

interface Props {
  annotation: EllipseAnnotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

export function EllipseAnnotationShape({
  annotation,
  isSelected,
  onSelect,
  onChange,
  scale,
}: Props) {
  const shapeRef = useRef<Konva.Ellipse>(null);
  const colors = getIEColors();

  return (
    <Ellipse
      ref={shapeRef}
      id={annotation.id}
      x={annotation.x * scale}
      y={annotation.y * scale}
      radiusX={annotation.radiusX * scale}
      radiusY={annotation.radiusY * scale}
      fill={annotation.fill}
      stroke={isSelected ? colors.selection : annotation.stroke}
      strokeWidth={annotation.strokeWidth}
      rotation={annotation.rotation}
      draggable
      onClick={() => onSelect(annotation.id)}
      onTap={() => onSelect(annotation.id)}
      onMouseEnter={handleCursorPointer}
      onMouseLeave={handleCursorDefault}
      onDragEnd={(e) => {
        onChange(annotation.id, {
          x: e.target.x() / scale,
          y: e.target.y() / scale,
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleXNode = node.scaleX();
        const scaleYNode = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange(annotation.id, {
          x: node.x() / scale,
          y: node.y() / scale,
          radiusX: (node.radiusX() * scaleXNode) / scale,
          radiusY: (node.radiusY() * scaleYNode) / scale,
          rotation: node.rotation(),
        });
      }}
    />
  );
};
