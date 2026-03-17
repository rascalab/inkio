import type { ImageEditorLocale } from '../types';

interface DesktopBottomDockProps {
  locale: ImageEditorLocale;
  children: React.ReactNode;
  onSave: () => void;
  isSaving: boolean;
  isLoading: boolean;
}

export function DesktopBottomDock({
  locale,
  children,
  onSave,
  isSaving,
  isLoading,
}: DesktopBottomDockProps) {
  return (
    <div className="inkio-ie-bottom-dock" data-testid="inkio-ie-bottom-dock">
      <div className="inkio-ie-bottom-dock-scroll">{children}</div>
      <div className="inkio-ie-bottom-dock-actions">
        <button
          type="button"
          className="inkio-ie-dock-save-btn"
          disabled={isSaving || isLoading}
          onClick={onSave}
          data-testid="inkio-ie-save"
        >
          {isSaving ? `${locale.save}...` : locale.save}
        </button>
      </div>
    </div>
  );
}
