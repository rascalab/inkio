import { CloseIcon, MinusIcon, PlusIcon, RedoIcon, UndoIcon } from '../icons';
import type { ImageEditorLocale } from '../types';
import type { ViewportKind } from '../utils/controls-model';

interface EditorCommandBarProps {
  locale: ImageEditorLocale;
  viewportKind: ViewportKind;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isLoading: boolean;
  zoomLabel: string;
  isZoomMin: boolean;
  isZoomMax: boolean;
  isZoomFit: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
}

export function EditorCommandBar({
  locale, viewportKind, canUndo, canRedo, isSaving, isLoading,
  zoomLabel, isZoomMin, isZoomMax, isZoomFit,
  onClose, onUndo, onRedo, onSave, onZoomOut, onZoomIn, onZoomFit,
}: EditorCommandBarProps) {
  const mobile = viewportKind === 'mobile';
  const buttonClass = mobile ? 'inkio-ie-mobile-command-btn' : 'inkio-ie-topbar-btn';
  const zoomButtonClass = mobile ? buttonClass : 'inkio-ie-dock-btn';
  const percentage = <span data-testid="inkio-ie-zoom-label" aria-live="polite">{zoomLabel}</span>;
  const fit = (
    <button
      type="button"
      className={mobile ? 'inkio-ie-mobile-zoom-label' : 'inkio-ie-dock-fit-btn'}
      onClick={onZoomFit}
      disabled={isZoomFit}
      data-testid="inkio-ie-zoom-fit"
      aria-label={locale.fit}
      title={locale.fit}
    >
      {mobile ? percentage : locale.fit}
    </button>
  );
  const zoom = (
    <div
      className={mobile ? 'inkio-ie-mobile-zoom-group' : 'inkio-ie-bottom-dock-zoom'}
      data-testid="inkio-ie-zoom-controls"
      role="group"
      aria-label={locale.zoom}
    >
      <button
        type="button"
        className={zoomButtonClass}
        onClick={onZoomOut}
        disabled={isZoomMin}
        data-testid="inkio-ie-zoom-out"
        aria-label={locale.zoomOutLabel ?? 'Zoom out'}
      >
        <MinusIcon size={16} />
      </button>
      {mobile ? fit : <span className="inkio-ie-dock-zoom-label">{percentage}</span>}
      <button
        type="button"
        className={zoomButtonClass}
        onClick={onZoomIn}
        disabled={isZoomMax}
        data-testid="inkio-ie-zoom-in"
        aria-label={locale.zoomInLabel ?? 'Zoom in'}
      >
        <PlusIcon size={16} />
      </button>
      {!mobile && fit}
    </div>
  );

  return (
    <>
      <div
        className={mobile ? 'inkio-ie-mobile-command-bar' : 'inkio-ie-topbar'}
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
        {!mobile && <span className="inkio-ie-topbar-spacer" />}
        <div className={mobile ? 'inkio-ie-mobile-command-group' : 'inkio-ie-history-group'}>
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
        {mobile && zoom}
        <button
          type="button"
          className={mobile ? 'inkio-ie-mobile-save-btn' : 'inkio-ie-topbar-save'}
          onClick={onSave}
          disabled={isSaving || isLoading}
          aria-busy={isSaving}
          data-testid="inkio-ie-save"
        >
          <span>{locale.save}</span>
        </button>
      </div>
      {!mobile && (
        <div className="inkio-ie-top-zoom-cluster" data-testid="inkio-ie-desktop-zoom-cluster">
          {zoom}
        </div>
      )}
    </>
  );
}
