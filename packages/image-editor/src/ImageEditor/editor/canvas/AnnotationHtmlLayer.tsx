import type { ReactNode } from 'react';

interface AnnotationHtmlLayerProps {
  displayWidth: number;
  displayHeight: number;
  annotationScale: number;
  cropX: number;
  cropY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  children: ReactNode;
}

export function AnnotationHtmlLayer({
  displayWidth,
  displayHeight,
  annotationScale,
  cropX,
  cropY,
  rotation,
  flipX,
  flipY,
  children,
}: AnnotationHtmlLayerProps) {
  return (
    <div
      className="inkio-ie-annotation-layer"
      style={{
        width: displayWidth,
        height: displayHeight,
      }}
    >
      <div
        className="inkio-ie-annotation-layer-transform"
        style={{
          transform: `rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
        }}
      >
        <div
          className="inkio-ie-annotation-layer-content"
          style={{
            left: `${-cropX * annotationScale}px`,
            top: `${-cropY * annotationScale}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
