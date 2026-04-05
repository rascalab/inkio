
import { Image as KonvaImage } from 'react-konva';
import type { Transform } from '../types';
import { getBaseDisplayDimensions } from '../utils/geometry';

interface ImageNodeProps {
  image: HTMLImageElement;
  displayWidth: number;
  displayHeight: number;
  transform: Transform;
}

export function ImageNode({
  image,
  displayWidth,
  displayHeight,
  transform,
}: ImageNodeProps) {
  const cropRect = transform.crop;
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    displayWidth, displayHeight, transform.rotation,
  );

  if (cropRect) {
    return (
      <KonvaImage
        image={image}
        x={displayWidth / 2}
        y={displayHeight / 2}
        width={baseW}
        height={baseH}
        offsetX={baseW / 2}
        offsetY={baseH / 2}
        rotation={transform.rotation}
        scaleX={transform.flipX ? -1 : 1}
        scaleY={transform.flipY ? -1 : 1}
        crop={{
          x: cropRect.x,
          y: cropRect.y,
          width: cropRect.width,
          height: cropRect.height,
        }}
      />
    );
  }

  return (
    <KonvaImage
      image={image}
      x={displayWidth / 2}
      y={displayHeight / 2}
      width={baseW}
      height={baseH}
      offsetX={baseW / 2}
      offsetY={baseH / 2}
      rotation={transform.rotation}
      scaleX={transform.flipX ? -1 : 1}
      scaleY={transform.flipY ? -1 : 1}
    />
  );
};
