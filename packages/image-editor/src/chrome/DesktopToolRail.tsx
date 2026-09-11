import type { EnabledToolType, ImageEditorLocale } from '../types';
import { EditorToolbar } from '../toolbar/EditorToolbar';

interface DesktopToolRailProps {
  activeTool: EnabledToolType | null;
  enabledTools: EnabledToolType[];
  locale: ImageEditorLocale;
  onToolChange: (tool: EnabledToolType) => void;
}

export function DesktopToolRail({
  activeTool,
  enabledTools,
  locale,
  onToolChange,
}: DesktopToolRailProps) {
  return (
    <div className="inkio-ie-tool-rail" data-testid="inkio-ie-tool-rail">
      <EditorToolbar
        activeTool={activeTool}
        enabledTools={enabledTools}
        locale={locale}
        onToolChange={onToolChange}
      />
    </div>
  );
}
