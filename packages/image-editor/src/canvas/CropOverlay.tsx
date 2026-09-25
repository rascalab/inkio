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
  // A mid-drag frame may transiently carry negative or oversized values:
  // normalize once so no mask ever emits a negative CSS size.
  const x = Math.max(0, frame.x);
  const y = Math.max(0, frame.y);
  const width = Math.max(0, frame.width);
  const height = Math.max(0, frame.height);
  const rightWidth = Math.max(0, containerWidth - x - width);
  const bottomHeight = Math.max(0, containerHeight - y - height);

  return (
    <div className="inkio-ie-crop-overlay" data-testid="inkio-ie-crop-overlay">
      <div className="inkio-ie-crop-mask" style={{ top: 0, left: 0, width: containerWidth, height: y }} />
      <div className="inkio-ie-crop-mask" style={{ top: y + height, left: 0, width: containerWidth, height: bottomHeight }} />
      <div className="inkio-ie-crop-mask" style={{ top: y, left: 0, width: x, height }} />
      <div className="inkio-ie-crop-mask" style={{ top: y, left: x + width, width: rightWidth, height }} />

      <div
        className="inkio-ie-crop-frame"
        style={{
          left: x,
          top: y,
          width,
          height,
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
