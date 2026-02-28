
import { Image as KonvaImage } from 'react-konva';
import type { Transform } from '../types';

interface ImageNodeProps {
  image: HTMLImageElement;
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
  transform: Transform;
}

export function ImageNode({
  image,
  originalWidth,
  originalHeight,
  displayWidth,
  displayHeight,
  transform,
}: ImageNodeProps) {
  const cropRect = transform.crop;

  if (cropRect) {
    return (
      <KonvaImage
        image={image}
        x={displayWidth / 2}
        y={displayHeight / 2}
        width={displayWidth}
        height={displayHeight}
        offsetX={displayWidth / 2}
        offsetY={displayHeight / 2}
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
      width={originalWidth}
      height={originalHeight}
      offsetX={originalWidth / 2}
      offsetY={originalHeight / 2}
      rotation={transform.rotation}
      scaleX={(transform.flipX ? -1 : 1) * (displayWidth / originalWidth)}
      scaleY={(transform.flipY ? -1 : 1) * (displayHeight / originalHeight)}
    />
  );
};
