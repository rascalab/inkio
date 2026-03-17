import type { CropRect } from '../types';

export function getDefaultCropRect(
  width: number,
  height: number,
  aspectRatio: number | null,
): CropRect {
  if (width <= 0 || height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
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
