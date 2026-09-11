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

let _measureCtx: CanvasRenderingContext2D | null | undefined;

function getTextMeasureContext(): CanvasRenderingContext2D | null {
  if (_measureCtx !== undefined) {
    return _measureCtx;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    _measureCtx = null;
    return null;
  }

  _measureCtx = document.createElement('canvas').getContext('2d');
  return _measureCtx;
}

function estimateLineWidth(line: string, fontSizePx: number): number {
  if (line.length === 0) return fontSizePx * 0.62;
  // CJK/full-width glyphs advance ~1em (vs ~0.62em for Latin), so mixing the
  // two per character keeps the canvas fallback estimate close for Korean,
  // Japanese, and Chinese text when no measure context is available.
  let width = 0;
  for (const char of line) {
    const code = char.codePointAt(0) ?? 0;
    const isFullWidth =
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0x9fff) || // CJK radicals, ideographs
      (code >= 0xac00 && code <= 0xd7af) || // Hangul syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
      (code >= 0xff00 && code <= 0xffef) || // Full-width forms
      (code >= 0x3000 && code <= 0x303f); // CJK symbols/punctuation
    width += fontSizePx * (isFullWidth ? 1.0 : 0.62);
  }
  return width;
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
  const fontSizePx = resolveTextFontSizePx(annotation.fontSize);
  return Math.max(TEXT_MIN_HEIGHT * scale, fontSizePx * scale * TEXT_LINE_HEIGHT + TEXT_PADDING * 2);
}

export function getPreferredTextAnnotationWidth(
  annotation: Pick<TextAnnotationData, 'text' | 'fontSize' | 'fontStyle' | 'width' | 'fontFamily'>,
): number {
  const lines = (annotation.text || '').split('\n');
  const context = getTextMeasureContext();
  const { fontStyle, fontWeight } = getTextFontStyle(annotation.fontStyle);
  const fontSizePx = resolveTextFontSizePx(annotation.fontSize);
  const fontFamily = annotation.fontFamily || TEXT_DEFAULT_FONT_FAMILY;

  if (context) {
    context.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
  }

  const measuredWidth = lines.reduce((maxWidth, line) => {
    const width = context ? context.measureText(line || ' ').width : estimateLineWidth(line, fontSizePx);
    return Math.max(maxWidth, width);
  }, 0);

  return Math.max(
    getTextAnnotationWidth(annotation),
    TEXT_MIN_WIDTH,
    Math.ceil(measuredWidth + TEXT_PADDING * 2 + 8),
  );
}
