import { CloseIcon, RedoIcon, UndoIcon } from '../icons';
import type { ImageEditorLocale } from '../types';
import type { ViewportKind } from '../utils/controls-model';

interface EditorCommandBarProps {
  locale: ImageEditorLocale;
  viewportKind: ViewportKind;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

export function EditorCommandBar({
  locale, viewportKind, canUndo, canRedo, isSaving, isLoading,
  onClose, onUndo, onRedo, onSave,
}: EditorCommandBarProps) {
  const mobile = viewportKind === 'mobile';
  const buttonClass = mobile ? 'inkio-ie-topbar-btn inkio-ie-mobile-command-btn' : 'inkio-ie-topbar-btn';

  return (
    <div
      className={mobile ? 'inkio-ie-topbar inkio-ie-mobile-command-bar' : 'inkio-ie-topbar'}
      data-testid={mobile ? 'inkio-ie-mobile-command-bar' : 'inkio-ie-topbar'}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={onClose}
        disabled={isSaving}
        title={locale.cancel}
        aria-label={locale.cancel}
        data-testid="inkio-ie-close"
      >
        <CloseIcon size={18} />
      </button>
      <div className={mobile ? 'inkio-ie-history-group inkio-ie-mobile-command-group' : 'inkio-ie-history-group'}>
        {[
          { id: 'undo', label: locale.undo, available: canUndo, action: onUndo, Icon: UndoIcon },
          { id: 'redo', label: locale.redo, available: canRedo, action: onRedo, Icon: RedoIcon },
        ].map(({ id, label, available, action, Icon }) => (
          <button
            key={id}
            type="button"
            className={buttonClass}
            onClick={action}
            disabled={!available || isSaving}
            title={label}
            aria-label={label}
            data-testid={`inkio-ie-${id}`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={mobile ? 'inkio-ie-topbar-save inkio-ie-mobile-save-btn' : 'inkio-ie-topbar-save'}
        onClick={onSave}
        disabled={isSaving || isLoading}
        aria-busy={isSaving}
        data-testid="inkio-ie-save"
      >
        <span>{locale.save}</span>
      </button>
    </div>
  );
}
