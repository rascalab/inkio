import type { ToolType } from '../types';
import { DrawOptionsPanel } from './options/DrawOptionsPanel';
import { ResizeOptions } from './options/ResizeOptions';
import { RotateOptionsPanel } from './options/RotateOptionsPanel';
import { ShapeOptionsPanel } from './options/ShapeOptionsPanel';
import { TextOptionsPanel } from './options/TextOptionsPanel';
import {
  getSelectedAnnotation,
  isDrawAnnotation,
  isShapeAnnotation,
  isTextAnnotation,
} from '../utils/annotation-types';

export type ControlPanel = 'resize' | 'draw' | 'shape' | 'text' | 'rotate';
export type ViewportKind = 'desktop' | 'mobile';

export type ResolvedControlsModel =
  | { kind: 'none' }
  | {
    kind: 'surface';
    surface: 'dock' | 'strip';
    panel: ControlPanel;
    source: 'tool' | 'selection';
  };

interface ToolControlsProps {
  panel: ControlPanel;
  viewportKind: ViewportKind;
}

export function resolveControlsModel(
  activeTool: ToolType | null,
  selectedAnnotation: ReturnType<typeof getSelectedAnnotation>,
  viewportKind: ViewportKind,
): ResolvedControlsModel {
  const resolvedPanel = resolveControlPanel(activeTool, selectedAnnotation);
  if (!resolvedPanel) {
    return { kind: 'none' };
  }

  return {
    kind: 'surface',
    surface: viewportKind === 'desktop' ? 'dock' : 'strip',
    panel: resolvedPanel.panel,
    source: resolvedPanel.source,
  };
}

function resolveControlPanel(
  activeTool: ToolType | null,
  selectedAnnotation: ReturnType<typeof getSelectedAnnotation>,
): { panel: ControlPanel; source: 'tool' | 'selection' } | null {
  if (isDrawAnnotation(selectedAnnotation)) {
    return { panel: 'draw', source: 'selection' };
  }

  if (isShapeAnnotation(selectedAnnotation)) {
    return { panel: 'shape', source: 'selection' };
  }

  if (isTextAnnotation(selectedAnnotation)) {
    return { panel: 'text', source: 'selection' };
  }

  if (activeTool === 'resize' || activeTool === 'crop') {
    return { panel: 'resize', source: 'tool' };
  }
  if (activeTool === 'draw') {
    return { panel: 'draw', source: 'tool' };
  }
  if (activeTool === 'shape') {
    return { panel: 'shape', source: 'tool' };
  }
  if (activeTool === 'text') {
    return { panel: 'text', source: 'tool' };
  }
  if (activeTool === 'rotate') {
    return { panel: 'rotate', source: 'tool' };
  }

  return null;
}

export function ToolOptionsPanel({ panel, viewportKind }: ToolControlsProps) {
  return (
    <div
      className="inkio-ie-tool-controls"
      data-testid={viewportKind === 'desktop' ? 'inkio-ie-bottom-dock-controls' : 'inkio-ie-mobile-option-strip-controls'}
      data-panel={panel}
      data-viewport-kind={viewportKind}
    >
      {panel === 'resize' && <ResizeOptions />}
      {panel === 'draw' && <DrawOptionsPanel />}
      {panel === 'shape' && <ShapeOptionsPanel />}
      {panel === 'text' && <TextOptionsPanel />}
      {panel === 'rotate' && <RotateOptionsPanel />}
    </div>
  );
}
