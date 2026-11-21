import type { CropRect } from '../types';

interface CropOverlayProps {
  frame: CropRect;
}

export function CropOverlay({
  frame,
}: CropOverlayProps) {
  const { x, y } = frame;
  const width = Math.max(0, frame.width);
  const height = Math.max(0, frame.height);

  return (
    <div className="inkio-ie-crop-overlay" data-testid="inkio-ie-crop-overlay">
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
