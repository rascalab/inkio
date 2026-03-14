import { useRef } from 'react';
import { Rect } from 'react-konva';
import type Konva from 'konva';
import type { RectAnnotation, Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';

interface Props {
  annotation: RectAnnotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

export function RectAnnotationShape({
  annotation,
  isSelected: _isSelected,
  onSelect,
  onChange,
  scale,
}: Props) {
  const shapeRef = useRef<Konva.Rect>(null);

  return (
    <Rect
      ref={shapeRef}
      id={annotation.id}
      x={annotation.x * scale}
      y={annotation.y * scale}
      width={annotation.width * scale}
      height={annotation.height * scale}
      fill={annotation.fill}
      stroke={annotation.stroke}
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
          width: (node.width() * scaleXNode) / scale,
          height: (node.height() * scaleYNode) / scale,
          rotation: node.rotation(),
        });
      }}
    />
  );
};
