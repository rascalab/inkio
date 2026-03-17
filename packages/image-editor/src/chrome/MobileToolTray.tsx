import type { EnabledToolType, ImageEditorLocale } from '../types';
import { TOOL_ICONS, TOOL_LOCALE_KEYS } from '../toolbar/EditorToolbar';

interface MobileToolTrayProps {
  activeTool: EnabledToolType | null;
  enabledTools: EnabledToolType[];
  locale: ImageEditorLocale;
  onToolChange: (tool: EnabledToolType) => void;
}

export function MobileToolTray({
  activeTool,
  enabledTools,
  locale,
  onToolChange,
}: MobileToolTrayProps) {
  return (
    <div
      className="inkio-ie-mobile-tool-tray"
      data-testid="inkio-ie-mobile-tool-tray"
      role="toolbar"
      aria-label={locale.toolsLabel ?? 'Image editor tools'}
    >
      {enabledTools.map((tool) => {
        const Icon = TOOL_ICONS[tool];
        const label = locale[TOOL_LOCALE_KEYS[tool]] as string;

        return (
          <button
            key={tool}
            type="button"
            className={`inkio-ie-mobile-tool-btn${activeTool === tool ? ' is-active' : ''}`}
            aria-label={label}
            title={label}
            data-testid={`inkio-ie-tool-${tool}`}
            onClick={() => onToolChange(tool)}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}
