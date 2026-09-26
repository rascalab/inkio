import {
  pickMessageLocale,
  type DeepPartial,
  type InkioMessageOverrides,
} from '@inkio/core';
import type { ImageEditorLocale } from '../types';

export interface InkioImageEditorMessages {
  imageEditor: ImageEditorLocale;
}

export type InkioImageEditorMessageOverrides = DeepPartial<InkioImageEditorMessages>;

export const koImageEditorMessages: InkioImageEditorMessages = {
  imageEditor: {
    crop: '자르기',
    rotate: '회전',
    resize: '크기 조절',
    draw: '그리기',
    drawDefaults: '새 그리기 기본값',
    selectedDraw: '선택한 그리기',
    shapes: '도형',
    shapeDefaults: '새 도형 기본값',
    selectedShape: '선택한 도형',
    text: '텍스트',
    textContent: '텍스트 내용',
    textBoxWidth: '텍스트 상자 너비',
    textDefaults: '새 텍스트 기본값',
    selectedText: '선택한 텍스트',
    layerOrder: '레이어 순서',
    bringToFront: '맨 앞으로',
    bringForward: '앞으로',
    sendBackward: '뒤로',
    sendToBack: '맨 뒤로',
    save: '저장',
    cancel: '취소',
    apply: '적용',
    reset: '초기화',
    editCrop: '자르기 영역 편집',
    doneCropping: '자르기 완료',
    cropArea: '자르기 영역',
    cropPendingNotice: '저장하면 현재 자르기 영역이 적용됩니다.',
    undo: '실행 취소',
    redo: '다시 실행',
    flip: '뒤집기',
    flipH: '좌우 반전',
    flipV: '상하 반전',
    rotateCW: '시계 방향 회전',
    rotateCCW: '반시계 방향 회전',
    freeform: '자유 비율',
    square: '정사각형',
    landscape: '가로',
    portrait: '세로',
    brushSize: '브러시 크기',
    strokeWidth: '선 두께',
    color: '색상',
    customColor: '사용자 지정 색상',
    fontFamily: '글꼴',
    fontFamilyPlaceholder: '글꼴 이름 입력',
    fontSize: '글자 크기',
    fontSizePercent: '글자 크기(%)',
    colorHex: 'HEX 색상',
    colorAlpha: '불투명도',
    colorPalette: '색상 팔레트',
    bold: '굵게',
    italic: '기울임',
    width: '너비',
    height: '높이',
    lockAspectRatio: '가로세로 비율 고정',
    rectangle: '사각형',
    ellipse: '타원',
    arrow: '화살표',
    line: '직선',
    fill: '채우기',
    stroke: '외곽선',
    transparent: '투명',
    opacity: '불투명도',
    zoom: '확대/축소',
    fit: '맞춤',
    filter: '필터',
    filterNone: '없음',
    filterGrayscale: '흑백',
    filterSepia: '세피아',
    filterInvert: '반전',
    filterWarm: '따뜻하게',
    filterCool: '차갑게',
    filterDramatic: '드라마틱',
    filterSoft: '부드럽게',
    filterVintage: '빈티지',
    finetune: '미세 조정',
    brightness: '밝기',
    contrast: '대비',
    saturation: '채도',
    clarity: '선명도',
    resetFinetune: '조정 초기화',
    redact: '모자이크',
    sticker: '스티커',
    pixelate: '픽셀화',
    blur: '흐림',
    strength: '강도',
    emoji: '이모지',
    closeConfirm: '이미지 편집 내용을 버릴까요?',
    smallViewportTitle: '아주 작은 화면에서는 이미지 편집을 사용할 수 없습니다.',
    smallViewportBody: '더 큰 휴대폰, 태블릿 또는 데스크톱 창을 사용하세요.',
    loading: '불러오는 중…',
    error: '문제가 발생했습니다.',
    deleteLabel: '삭제',
    zoomInLabel: '확대',
    zoomOutLabel: '축소',
    toolsLabel: '이미지 편집 도구',
  },
};

export const enImageEditorMessages: InkioImageEditorMessages = {
  imageEditor: {
    crop: 'Crop',
    rotate: 'Rotate',
    resize: 'Resize',
    draw: 'Draw',
    drawDefaults: 'New draw defaults',
    selectedDraw: 'Selected drawing',
    shapes: 'Shapes',
    shapeDefaults: 'New shape defaults',
    selectedShape: 'Selected shape',
    text: 'Text',
    textContent: 'Text content',
    textBoxWidth: 'Text box width',
    textDefaults: 'New text defaults',
    selectedText: 'Selected text',
    layerOrder: 'Layer order',
    bringToFront: 'To front',
    bringForward: 'Forward',
    sendBackward: 'Backward',
    sendToBack: 'To back',
    save: 'Save',
    cancel: 'Cancel',
    apply: 'Apply',
    reset: 'Reset',
    editCrop: 'Edit crop area',
    doneCropping: 'Done cropping',
    cropArea: 'Crop area',
    cropPendingNotice: 'Save will apply the current crop area.',
    undo: 'Undo',
    redo: 'Redo',
    flip: 'Flip',
    flipH: 'Flip horizontal',
    flipV: 'Flip vertical',
    rotateCW: 'Rotate clockwise',
    rotateCCW: 'Rotate counterclockwise',
    freeform: 'Freeform',
    square: 'Square',
    landscape: 'Landscape',
    portrait: 'Portrait',
    brushSize: 'Brush size',
    strokeWidth: 'Stroke width',
    color: 'Color',
    customColor: 'Custom color',
    fontFamily: 'Font family',
    fontFamilyPlaceholder: 'Enter a font family',
    fontSize: 'Font size',
    fontSizePercent: 'Font size (%)',
    colorHex: 'Hex color',
    colorAlpha: 'Opacity',
    colorPalette: 'Color palette',
    bold: 'Bold',
    italic: 'Italic',
    width: 'Width',
    height: 'Height',
    lockAspectRatio: 'Lock aspect ratio',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    arrow: 'Arrow',
    line: 'Line',
    fill: 'Fill',
    stroke: 'Stroke',
    transparent: 'Transparent',
    opacity: 'Opacity',
    zoom: 'Zoom',
    fit: 'Fit',
    filter: 'Filter',
    filterNone: 'None',
    filterGrayscale: 'Grayscale',
    filterSepia: 'Sepia',
    filterInvert: 'Invert',
    filterWarm: 'Warm',
    filterCool: 'Cool',
    filterDramatic: 'Dramatic',
    filterSoft: 'Soft',
    filterVintage: 'Vintage',
    finetune: 'Finetune',
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    clarity: 'Clarity',
    resetFinetune: 'Reset adjustments',
    redact: 'Redact',
    sticker: 'Sticker',
    pixelate: 'Pixelate',
    blur: 'Blur',
    strength: 'Strength',
    emoji: 'Emoji',
    closeConfirm: 'Discard your image edits?',
    smallViewportTitle: 'Image editing is unavailable on very small screens.',
    smallViewportBody: 'Use a larger phone, tablet, or desktop window to edit this image.',
    loading: 'Loading...',
    error: 'Something went wrong.',
    deleteLabel: 'Delete',
    zoomInLabel: 'Zoom in',
    zoomOutLabel: 'Zoom out',
    toolsLabel: 'Image editor tools',
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return base;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }

    // Prototype-pollution guard: never merge magic keys, even from
    // consumer-supplied message overrides (e.g. JSON parsed payloads).
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const existing = result[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value as DeepPartial<typeof existing>);
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

export function toImageEditorMessageOverrides(
  input?: InkioImageEditorMessageOverrides | InkioMessageOverrides,
): InkioImageEditorMessageOverrides | undefined {
  if (!input) {
    return undefined;
  }

  if ('core' in input || 'extensions' in input) {
    const root = input as InkioMessageOverrides;
    if (!root.extensions || typeof root.extensions !== 'object') {
      return undefined;
    }
    return root.extensions as InkioImageEditorMessageOverrides;
  }

  return input as InkioImageEditorMessageOverrides;
}

const IMAGE_EDITOR_MESSAGESETS = {
  en: enImageEditorMessages,
  ko: koImageEditorMessages,
} as const satisfies Record<string, InkioImageEditorMessages>;

export type InkioImageEditorLocaleId = keyof typeof IMAGE_EDITOR_MESSAGESETS;

export function resolveImageEditorMessages(
  localeInput: unknown,
  overrides?: InkioImageEditorMessageOverrides,
): InkioImageEditorMessages {
  const locale = pickMessageLocale(localeInput, Object.keys(IMAGE_EDITOR_MESSAGESETS));

  return deepMerge(
    (IMAGE_EDITOR_MESSAGESETS as Record<string, InkioImageEditorMessages>)[locale] ?? enImageEditorMessages,
    overrides,
  );
}

export function mergeImageEditorMessages(
  localeInput: unknown,
  ...overrides: Array<InkioImageEditorMessageOverrides | undefined>
): InkioImageEditorMessages {
  return overrides.reduce<InkioImageEditorMessages>(
    (acc, current) => deepMerge(acc, current),
    resolveImageEditorMessages(localeInput),
  );
}
