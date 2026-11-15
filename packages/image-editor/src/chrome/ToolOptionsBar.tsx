import type { ControlPanel, ViewportKind } from '../utils/controls-model';
import { ToolOptionsPanel } from '../toolbar/ToolOptionsPanel';

interface ToolOptionsBarProps {
  readonly panel: ControlPanel;
  readonly viewportKind: ViewportKind;
}

export function ToolOptionsBar({ panel, viewportKind }: ToolOptionsBarProps) {
  return (
    <div
      className="inkio-ie-options-bar"
      data-viewport-kind={viewportKind}
      data-testid={viewportKind === 'desktop' ? 'inkio-ie-util-panel' : 'inkio-ie-mobile-option-strip'}
    >
      <ToolOptionsPanel panel={panel} viewportKind={viewportKind} />
    </div>
  );
}
