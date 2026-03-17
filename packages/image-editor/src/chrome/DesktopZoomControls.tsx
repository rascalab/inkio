import { MinusIcon, PlusIcon } from '../icons';
import type { ImageEditorLocale } from '../types';

interface DesktopZoomControlsProps {
  locale: ImageEditorLocale;
  zoomLabel: string;
  isZoomMin: boolean;
  isZoomMax: boolean;
  isZoomFit: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
}

export function DesktopZoomControls({
  locale,
  zoomLabel,
  isZoomMin,
  isZoomMax,
  isZoomFit,
  onZoomOut,
  onZoomIn,
  onZoomFit,
}: DesktopZoomControlsProps) {
  return (
    <div className="inkio-ie-top-zoom-cluster" data-testid="inkio-ie-desktop-zoom-cluster">
      <div className="inkio-ie-bottom-dock-zoom" data-testid="inkio-ie-zoom-controls" role="group" aria-label={locale.zoom}>
        <button
          type="button"
          className="inkio-ie-dock-btn"
          onClick={onZoomOut}
          disabled={isZoomMin}
          data-testid="inkio-ie-zoom-out"
          aria-label={locale.zoomOutLabel ?? 'Zoom out'}
        >
          <MinusIcon size={16} />
        </button>
        <span className="inkio-ie-dock-zoom-label" data-testid="inkio-ie-zoom-label">
          {zoomLabel}
        </span>
        <button
          type="button"
          className="inkio-ie-dock-btn"
          onClick={onZoomIn}
          disabled={isZoomMax}
          data-testid="inkio-ie-zoom-in"
          aria-label={locale.zoomInLabel ?? 'Zoom in'}
        >
          <PlusIcon size={16} />
        </button>
        <button
          type="button"
          className="inkio-ie-dock-fit-btn"
          onClick={onZoomFit}
          disabled={isZoomFit}
          data-testid="inkio-ie-zoom-fit"
        >
          {locale.fit}
        </button>
      </div>
    </div>
  );
}
