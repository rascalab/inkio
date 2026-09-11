
import { useEffect, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { FilterPresetId, FinetuneOptions, Transform } from '../types';
import { getBaseDisplayDimensions } from '../utils/geometry';
import { DEFAULT_FINETUNE, scheduleFilteredPreview, cancelScheduledFilterPreview } from '../utils/filters';

interface ImageNodeProps {
  image: HTMLImageElement;
  displayWidth: number;
  displayHeight: number;
  transform: Transform;
  filter?: FilterPresetId;
  finetune?: FinetuneOptions;
}

export function ImageNode({
  image,
  displayWidth,
  displayHeight,
  transform,
  filter = 'none',
  finetune = DEFAULT_FINETUNE,
}: ImageNodeProps) {
  const cropRect = transform.crop;
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    displayWidth, displayHeight, transform.rotation,
  );
  const imageRef = useRef<Konva.Image>(null);

  // Konva filters only take effect on cached nodes; re-apply on every
  // filter/image/geometry change so preview matches export exactly.
  // Slider drags coalesce to one cache() per frame via the scheduler.
  useEffect(() => {
    const node = imageRef.current;
    if (!node) return;
    const isNeutral =
      filter === 'none' &&
      finetune.brightness === 0 &&
      finetune.contrast === 0 &&
      finetune.saturation === 0 &&
      finetune.clarity === 0;
    if (isNeutral) {
      cancelScheduledFilterPreview(node);
      node.filters([]);
      node.clearCache();
      node.getLayer()?.batchDraw();
    } else {
      scheduleFilteredPreview(node, filter, finetune);
    }
    return () => {
      const current = imageRef.current;
      if (current) cancelScheduledFilterPreview(current);
    };
  }, [filter, finetune, image, baseW, baseH]);

  if (cropRect) {
    return (
      <KonvaImage
        ref={imageRef}
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
      ref={imageRef}
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
