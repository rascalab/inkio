import type { CropRect } from '../types';

interface CropOverlayProps {
  containerWidth: number;
  containerHeight: number;
  frame: CropRect;
}

export function CropOverlay({
  containerWidth,
  containerHeight,
  frame,
}: CropOverlayProps) {
  const rightWidth = Math.max(0, containerWidth - frame.x - frame.width);
  const bottomHeight = Math.max(0, containerHeight - frame.y - frame.height);

  return (
    <div className="inkio-ie-crop-overlay" data-testid="inkio-ie-crop-overlay">
      <div className="inkio-ie-crop-mask" style={{ top: 0, left: 0, width: containerWidth, height: frame.y }} />
      <div className="inkio-ie-crop-mask" style={{ top: frame.y + frame.height, left: 0, width: containerWidth, height: bottomHeight }} />
      <div className="inkio-ie-crop-mask" style={{ top: frame.y, left: 0, width: frame.x, height: frame.height }} />
      <div className="inkio-ie-crop-mask" style={{ top: frame.y, left: frame.x + frame.width, width: rightWidth, height: frame.height }} />

      <div
        className="inkio-ie-crop-frame"
        style={{
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        }}
      >
        <div className="inkio-ie-crop-guide inkio-ie-crop-guide--v" style={{ left: '33.3333%' }} />
        <div className="inkio-ie-crop-guide inkio-ie-crop-guide--v" style={{ left: '66.6667%' }} />
        <div className="inkio-ie-crop-guide inkio-ie-crop-guide--h" style={{ top: '33.3333%' }} />
        <div className="inkio-ie-crop-guide inkio-ie-crop-guide--h" style={{ top: '66.6667%' }} />
      </div>
    </div>
  );
}
