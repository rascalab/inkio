import { CloseIcon, RedoIcon, UndoIcon } from '../icons';
import type { ImageEditorLocale } from '../types';

interface DesktopTopBarProps {
  locale: ImageEditorLocale;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

export function DesktopTopBar({
  locale,
  canUndo,
  canRedo,
  isSaving,
  isLoading,
  onClose,
  onUndo,
  onRedo,
  onSave,
}: DesktopTopBarProps) {
  return (
    <div className="inkio-ie-topbar" data-testid="inkio-ie-topbar">
      <button
        type="button"
        className="inkio-ie-topbar-btn"
        onClick={onClose}
        title={locale.cancel}
        aria-label={locale.cancel}
        data-testid="inkio-ie-close"
      >
        <CloseIcon size={18} strokeWidth={2} />
      </button>
      <span className="inkio-ie-topbar-spacer" />
      <button
        type="button"
        className="inkio-ie-topbar-btn"
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
        className="inkio-ie-topbar-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title={locale.redo}
        aria-label={locale.redo}
        data-testid="inkio-ie-redo"
      >
        <RedoIcon size={18} />
      </button>
      <button
        type="button"
        className="inkio-ie-topbar-save"
        disabled={isSaving || isLoading}
        onClick={onSave}
        data-testid="inkio-ie-save"
      >
        {isSaving ? `${locale.save}...` : locale.save}
      </button>
    </div>
  );
}
