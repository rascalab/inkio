import { CloseIcon, MinusIcon, PlusIcon, RedoIcon, UndoIcon } from '../icons';
import type { ImageEditorLocale } from '../types';

interface MobileCommandBarProps {
  locale: ImageEditorLocale;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isLoading: boolean;
  zoomLabel: string;
  isZoomMin: boolean;
  isZoomMax: boolean;
  isZoomFit: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
}

export function MobileCommandBar({
  locale,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClose,
  onSave,
  isSaving,
  isLoading,
  zoomLabel,
  isZoomMin,
  isZoomMax,
  isZoomFit,
  onZoomOut,
  onZoomIn,
  onZoomFit,
}: MobileCommandBarProps) {
  return (
    <div className="inkio-ie-mobile-command-bar" data-testid="inkio-ie-mobile-command-bar">
      <button
        type="button"
        className="inkio-ie-mobile-command-btn"
        onClick={onClose}
        title={locale.cancel}
        aria-label={locale.cancel}
        data-testid="inkio-ie-close"
      >
        <CloseIcon size={18} />
      </button>
      <div className="inkio-ie-mobile-command-group">
        <button
          type="button"
          className="inkio-ie-mobile-command-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title={locale.undo}
          aria-label={locale.undo}
          data-testid="inkio-ie-undo"
        >
          <UndoIcon size={18} />
        </button>
        <button
          type="button"
          className="inkio-ie-mobile-command-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title={locale.redo}
          aria-label={locale.redo}
          data-testid="inkio-ie-redo"
        >
          <RedoIcon size={18} />
        </button>
      </div>
      <div className="inkio-ie-mobile-zoom-group" data-testid="inkio-ie-zoom-controls" role="group" aria-label={locale.zoom}>
        <button
          type="button"
          className="inkio-ie-mobile-command-btn"
          onClick={onZoomOut}
          disabled={isZoomMin}
          data-testid="inkio-ie-zoom-out"
          aria-label={locale.zoomOutLabel ?? 'Zoom out'}
        >
          <MinusIcon size={16} />
        </button>
        <button
          type="button"
          className="inkio-ie-mobile-zoom-label"
          onClick={onZoomFit}
          disabled={isZoomFit}
          data-testid="inkio-ie-zoom-label"
        >
          {zoomLabel}
        </button>
        <button
          type="button"
          className="inkio-ie-mobile-command-btn"
          onClick={onZoomIn}
          disabled={isZoomMax}
          data-testid="inkio-ie-zoom-in"
          aria-label={locale.zoomInLabel ?? 'Zoom in'}
        >
          <PlusIcon size={16} />
        </button>
        <button
          type="button"
          className="inkio-ie-mobile-fit-btn"
          onClick={onZoomFit}
          disabled={isZoomFit}
          data-testid="inkio-ie-zoom-fit"
        >
          {locale.fit}
        </button>
      </div>
      <button
        type="button"
        className="inkio-ie-mobile-save-btn"
        onClick={onSave}
        disabled={isSaving || isLoading}
        data-testid="inkio-ie-save"
      >
        {isSaving ? `${locale.save}...` : locale.save}
      </button>
    </div>
  );
}
