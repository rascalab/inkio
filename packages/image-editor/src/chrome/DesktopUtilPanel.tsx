import { ToolOptionsPanel, type ControlPanel } from '../toolbar/ToolOptionsPanel';

interface DesktopUtilPanelProps {
  panel: ControlPanel;
}

export function DesktopUtilPanel({ panel }: DesktopUtilPanelProps) {
  return (
    <div className="inkio-ie-util-panel" data-testid="inkio-ie-util-panel">
      <ToolOptionsPanel panel={panel} viewportKind="desktop" />
    </div>
  );
}
