import { useRef, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { TextAnnotationData, Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';
import {
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_MIN_WIDTH,
  TEXT_MIN_FONT_SIZE,
  getScaledTextWidth,
} from '../utils/textMetrics';

interface Props {
  annotation: TextAnnotationData;
  onSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  isEditing: boolean;
  scale: number;
}

export function TextAnnotationShape({
  annotation,
  onSelect,
  onStartEdit,
  onChange,
  isEditing,
  scale,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);

  const scaledX = annotation.x * scale;
  const scaledY = annotation.y * scale;
  const scaledWidth = getScaledTextWidth(annotation, scale);
  const scaledFontSize = annotation.fontSize * scale;
  const handleClick = useCallback(() => {
    onSelect(annotation.id);
  }, [annotation.id, onSelect]);

  const handleDblClick = useCallback(() => {
    onSelect(annotation.id);
    onStartEdit(annotation.id);
  }, [annotation.id, onSelect, onStartEdit]);

  // Hide group when editing — the TextEditOverlay handles display
  if (isEditing) {
    return null;
  }

  // Compute text height for hit region
  const textNode = textRef.current;
  const textHeight = textNode ? textNode.height() : scaledFontSize * 1.4 + 4;

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
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
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
        const nextFontSize = Math.max(TEXT_MIN_FONT_SIZE, annotation.fontSize * group.scaleY());

        onChange(annotation.id, {
          x: group.x() / scale,
          y: group.y() / scale,
          rotation: group.rotation(),
          width: nextWidth,
          fontSize: nextFontSize,
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
        fontFamily={TEXT_FONT_FAMILY}
        fill={annotation.text ? annotation.fill : `${annotation.fill}44`}
        fontStyle={annotation.fontStyle}
        width={scaledWidth}
        lineHeight={TEXT_LINE_HEIGHT}
        padding={2}
        listening={false}
      />
    </Group>
  );
}
