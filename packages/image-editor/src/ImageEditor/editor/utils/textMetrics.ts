import type { TextAnnotationData } from '../types';

export const TEXT_LINE_HEIGHT = 1.4;
export const TEXT_PADDING = 2;
export const TEXT_MIN_WIDTH = 80;
export const TEXT_MIN_FONT_SIZE = 8;
export const TEXT_FONT_FAMILY = 'system-ui';

export function getTextAnnotationWidth(annotation: Pick<TextAnnotationData, 'width'>): number {
  return Math.max(TEXT_MIN_WIDTH, annotation.width ?? TEXT_MIN_WIDTH);
}

export function getScaledTextWidth(annotation: Pick<TextAnnotationData, 'width'>, scale: number): number {
  return getTextAnnotationWidth(annotation) * scale;
}

export function getTextFontStyle(fontStyle: string): {
  fontStyle: 'normal' | 'italic';
  fontWeight: 'normal' | 'bold';
} {
  return {
    fontStyle: fontStyle.includes('italic') ? 'italic' : 'normal',
    fontWeight: fontStyle.includes('bold') ? 'bold' : 'normal',
  };
}

export function getTextAnnotationMinHeight(
  annotation: Pick<TextAnnotationData, 'fontSize'>,
  scale: number,
): number {
  return annotation.fontSize * scale * TEXT_LINE_HEIGHT + TEXT_PADDING * 2;
}
