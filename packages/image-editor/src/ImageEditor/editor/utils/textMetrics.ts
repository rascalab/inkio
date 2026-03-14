import type { TextAnnotationData } from '../types';

export const TEXT_LINE_HEIGHT = 1.4;
export const TEXT_PADDING = 2;
export const TEXT_MIN_WIDTH = 80;
export const TEXT_MIN_FONT_SIZE = 8;
export const TEXT_FONT_FAMILY = 'system-ui';

function getTextMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return null;
  }

  const canvas = document.createElement('canvas');
  return canvas.getContext('2d');
}

function estimateLineWidth(line: string, fontSize: number): number {
  const effectiveLength = Math.max(line.length, 1);
  return effectiveLength * fontSize * 0.62;
}

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

export function getPreferredTextAnnotationWidth(
  annotation: Pick<TextAnnotationData, 'text' | 'fontSize' | 'fontStyle' | 'width'>,
): number {
  const lines = (annotation.text || '').split('\n');
  const context = getTextMeasureContext();
  const { fontStyle, fontWeight } = getTextFontStyle(annotation.fontStyle);

  if (context) {
    context.font = `${fontStyle} ${fontWeight} ${annotation.fontSize}px ${TEXT_FONT_FAMILY}`;
  }

  const measuredWidth = lines.reduce((maxWidth, line) => {
    const width = context ? context.measureText(line || ' ').width : estimateLineWidth(line, annotation.fontSize);
    return Math.max(maxWidth, width);
  }, 0);

  return Math.max(
    getTextAnnotationWidth(annotation),
    TEXT_MIN_WIDTH,
    Math.ceil(measuredWidth + TEXT_PADDING * 2 + 8),
  );
}
