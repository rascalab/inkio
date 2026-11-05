import { DrawOptionsPanel } from './options/DrawOptionsPanel';
import { FilterOptionsPanel } from './options/FilterOptionsPanel';
import { RedactOptionsPanel } from './options/RedactOptionsPanel';
import { ResizeOptions } from './options/ResizeOptions';
import { RotateOptionsPanel } from './options/RotateOptionsPanel';
import { ShapeOptionsPanel } from './options/ShapeOptionsPanel';
import { StickerOptionsPanel } from './options/StickerOptionsPanel';
import { TextOptionsPanel } from './options/TextOptionsPanel';
import type { ControlPanel, ViewportKind } from '../utils/controls-model';

interface ToolControlsProps {
  panel: ControlPanel;
  viewportKind: ViewportKind;
}

export function ToolOptionsPanel({ panel, viewportKind }: ToolControlsProps) {
  return (
    <div
      className="inkio-ie-tool-controls"
      data-testid={viewportKind === 'desktop' ? 'inkio-ie-util-panel-controls' : 'inkio-ie-mobile-option-strip-controls'}
      data-panel={panel}
      data-viewport-kind={viewportKind}
    >
      {panel === 'resize' && <ResizeOptions />}
      {panel === 'draw' && <DrawOptionsPanel />}
      {panel === 'shape' && <ShapeOptionsPanel />}
      {panel === 'text' && <TextOptionsPanel />}
      {panel === 'rotate' && <RotateOptionsPanel />}
      {panel === 'filter' && <FilterOptionsPanel />}
      {panel === 'redact' && <RedactOptionsPanel />}
      {panel === 'sticker' && <StickerOptionsPanel />}
    </div>
  );
}
