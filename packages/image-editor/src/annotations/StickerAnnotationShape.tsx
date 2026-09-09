import { useRef } from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import type { Annotation, StickerAnnotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';

export const STICKER_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif';

interface Props {
  annotation: StickerAnnotation;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

export function StickerAnnotationShape({
  annotation,
  onSelect,
  onChange,
  scale,
}: Props) {
  const textRef = useRef<Konva.Text>(null);

  return (
    <Text
      ref={textRef}
      id={annotation.id}
      x={annotation.x * scale}
      y={annotation.y * scale}
      text={annotation.emoji}
      fontSize={Math.max(1, annotation.size * scale)}
      fontFamily={STICKER_FONT_FAMILY}
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
        const node = textRef.current;
        if (!node) return;
        const nextSize = Math.max(
          8,
          annotation.size * Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY())),
        );
        node.scaleX(1);
        node.scaleY(1);
        onChange(annotation.id, {
          x: node.x() / scale,
          y: node.y() / scale,
          size: nextSize,
          rotation: node.rotation(),
        });
      }}
    />
  );
}
