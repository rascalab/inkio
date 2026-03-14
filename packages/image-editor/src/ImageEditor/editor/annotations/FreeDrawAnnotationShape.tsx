import { useRef } from 'react';
import { Line } from 'react-konva';
import type Konva from 'konva';
import type { FreeDrawAnnotation, Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';

interface Props {
  annotation: FreeDrawAnnotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

export function FreeDrawAnnotationShape({
  annotation,
  isSelected: _isSelected,
  onSelect,
  onChange,
  scale,
}: Props) {
  const shapeRef = useRef<Konva.Line>(null);

  return (
    <Line
      ref={shapeRef}
      id={annotation.id}
      points={annotation.points.map((p) => p * scale)}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth}
      opacity={annotation.opacity}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation="source-over"
      draggable
      onClick={() => onSelect(annotation.id)}
      onTap={() => onSelect(annotation.id)}
      onMouseEnter={handleCursorPointer}
      onMouseLeave={handleCursorDefault}
      onDragEnd={(e) => {
        const node = shapeRef.current;
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
      }}
    />
  );
};
