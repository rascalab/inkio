import { useRef, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { TextAnnotationData, Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';
import {
  TEXT_DEFAULT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_MIN_HEIGHT,
  TEXT_MIN_WIDTH,
  getScaledTextHeight,
  getScaledTextWidth,
  resolveTextFontSizePx,
} from '../utils/text-metrics';

interface Props {
  annotation: TextAnnotationData;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

export function TextAnnotationShape({
  annotation,
  onSelect,
  onChange,
  scale,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);

  const scaledX = annotation.x * scale;
  const scaledY = annotation.y * scale;
  const scaledWidth = getScaledTextWidth(annotation, scale);
  const scaledHeight = getScaledTextHeight(annotation, scale);
  const scaledFontSize = resolveTextFontSizePx(annotation.fontSize) * scale;
  const handleClick = useCallback(() => {
    onSelect(annotation.id);
  }, [annotation.id, onSelect]);

  // Compute text height for hit region
  const textNode = textRef.current;
  const textHeight = Math.max(scaledHeight, textNode ? textNode.height() : scaledFontSize * 1.4 + 4);

  return (
    <Group
      ref={groupRef}
      id={annotation.id}
      x={scaledX}
      y={scaledY}
      rotation={annotation.rotation}
      draggable
      onMouseEnter={handleCursorPointer}
      onMouseLeave={handleCursorDefault}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={(e) => {
        onChange(annotation.id, {
          x: e.target.x() / scale,
          y: e.target.y() / scale,
        });
      }}
      onTransformEnd={() => {
        const group = groupRef.current;
        if (!group) return;

        const nextWidth = Math.max(TEXT_MIN_WIDTH, (scaledWidth * group.scaleX()) / scale);
        const nextHeight = Math.max(TEXT_MIN_HEIGHT, (scaledHeight * group.scaleY()) / scale);

        onChange(annotation.id, {
          x: group.x() / scale,
          y: group.y() / scale,
          rotation: group.rotation(),
          width: nextWidth,
          height: nextHeight,
        });
        group.scaleX(1);
        group.scaleY(1);
      }}
    >
      {/* Invisible hit region so clicks are caught by the Group */}
      <Rect
        width={scaledWidth}
        height={textHeight}
        fill="transparent"
      />
      <Text
        ref={textRef}
        text={annotation.text || 'Text'}
        fontSize={scaledFontSize}
        fontFamily={annotation.fontFamily || TEXT_DEFAULT_FONT_FAMILY}
        fill={annotation.text ? annotation.fill : `${annotation.fill}44`}
        fontStyle={annotation.fontStyle}
        width={scaledWidth}
        height={scaledHeight}
        lineHeight={TEXT_LINE_HEIGHT}
        padding={2}
        listening={false}
      />
    </Group>
  );
}
