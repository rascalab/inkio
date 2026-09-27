import type { TextAnnotationData } from '../types';

export const TEXT_LINE_HEIGHT = 1.4;
export const TEXT_PADDING = 2;
export const TEXT_MIN_WIDTH = 80;
export const TEXT_MIN_HEIGHT = 36;
export const TEXT_MIN_FONT_SIZE = 8;
export const TEXT_DEFAULT_FONT_FAMILY = 'system-ui';

export function resolveTextFontSizePx(fontSize: number): number {
  return Math.max(TEXT_MIN_FONT_SIZE, fontSize || 16);
}

export function getTextAnnotationWidth(annotation: Pick<TextAnnotationData, 'width'>): number {
  return Math.max(TEXT_MIN_WIDTH, annotation.width ?? TEXT_MIN_WIDTH);
}

export function getScaledTextWidth(annotation: Pick<TextAnnotationData, 'width'>, scale: number): number {
  return getTextAnnotationWidth(annotation) * scale;
}

export function getTextAnnotationHeight(
  annotation: Pick<TextAnnotationData, 'height' | 'fontSize'>,
): number {
  const fontSizePx = resolveTextFontSizePx(annotation.fontSize);
  return Math.max(TEXT_MIN_HEIGHT, annotation.height ?? (fontSizePx * TEXT_LINE_HEIGHT + TEXT_PADDING * 2));
}

export function getScaledTextHeight(
  annotation: Pick<TextAnnotationData, 'height' | 'fontSize'>,
  scale: number,
): number {
  return getTextAnnotationHeight(annotation) * scale;
}

export function getTextAnnotationMinHeight(
  annotation: Pick<TextAnnotationData, 'fontSize'>,
  scale: number,
): number {
  const fontSizePx = resolveTextFontSizePx(annotation.fontSize);
  return Math.max(TEXT_MIN_HEIGHT * scale, fontSizePx * scale * TEXT_LINE_HEIGHT + TEXT_PADDING * 2);
}
