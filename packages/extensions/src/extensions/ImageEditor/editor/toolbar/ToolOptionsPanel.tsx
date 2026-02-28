
import type { ToolType } from '../types';
import { CropOptions } from './options/CropOptions';
import { RotateFlipOptions } from './options/RotateFlipOptions';
import { ResizeOptions } from './options/ResizeOptions';
import { DrawOptionsPanel } from './options/DrawOptionsPanel';
import { ShapeOptionsPanel } from './options/ShapeOptionsPanel';
import { TextOptionsPanel } from './options/TextOptionsPanel';

interface ToolOptionsPanelProps {
  activeTool: ToolType | null;
}

export function ToolOptionsPanel({ activeTool }: ToolOptionsPanelProps) {
  return (
    <div className="inkio-ie-options-panel">
      {activeTool === 'crop' && <CropOptions />}
      {activeTool === 'rotate' && <RotateFlipOptions />}
      {activeTool === 'resize' && <ResizeOptions />}
      {activeTool === 'draw' && <DrawOptionsPanel />}
      {activeTool === 'shape' && <ShapeOptionsPanel />}
      {activeTool === 'text' && <TextOptionsPanel />}
      {!activeTool && (
        <div className="inkio-ie-options-empty">
          <span className="inkio-ie-options-empty-text">Select a tool to view options</span>
        </div>
      )}
    </div>
  );
};
