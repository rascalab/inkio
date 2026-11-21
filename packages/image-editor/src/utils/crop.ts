import type { CropRect, ImageEditorState } from '../types';

export function getDefaultCropRect(
  width: number,
  height: number,
  aspectRatio: number | null,
): CropRect {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Guard non-finite/non-positive ratios (NaN, Infinity, 0, negatives):
  // fall back to the full-frame rect instead of producing NaN geometry.
  if (aspectRatio !== null && (!Number.isFinite(aspectRatio) || aspectRatio <= 0)) {
    return { x: 0, y: 0, width, height };
  }

  if (aspectRatio) {
    const imageRatio = width / height;
    let cropWidth: number;
    let cropHeight: number;

    if (aspectRatio > imageRatio) {
      cropWidth = width;
      cropHeight = cropWidth / aspectRatio;
    } else {
      cropHeight = height;
      cropWidth = cropHeight * aspectRatio;
    }

    return {
      x: (width - cropWidth) / 2,
      y: (height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    };
  }

  return {
    x: 0,
    y: 0,
    width,
    height,
  };
}

/** Draft crops and applied crops both use unrotated source coordinates. */
export function getEffectivePendingCrop(state: ImageEditorState): CropRect | null {
  const { pendingCrop: draft, transform: { crop }, originalWidth, originalHeight } = state;
  if (!draft) return null;
  return draft.x === (crop?.x ?? 0)
    && draft.y === (crop?.y ?? 0)
    && draft.width === (crop?.width ?? originalWidth)
    && draft.height === (crop?.height ?? originalHeight)
    ? null
    : draft;
}
