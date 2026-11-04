import type { ToolType } from '../types';
import {
  getSelectedAnnotation,
  isDrawAnnotation,
  isRedactAnnotation,
  isShapeAnnotation,
  isStickerAnnotation,
  isTextAnnotation,
} from './annotation-types';

export type ControlPanel = 'resize' | 'draw' | 'shape' | 'text' | 'rotate' | 'filter' | 'redact' | 'sticker';
export type ViewportKind = 'desktop' | 'mobile';

export type ResolvedControlsModel =
  | { kind: 'none' }
  | {
    kind: 'surface';
    surface: 'dock' | 'strip';
    panel: ControlPanel;
    source: 'tool' | 'selection';
  };

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

  if (isRedactAnnotation(selectedAnnotation)) {
    return { panel: 'redact', source: 'selection' };
  }

  if (isStickerAnnotation(selectedAnnotation)) {
    return { panel: 'sticker', source: 'selection' };
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
  if (activeTool === 'filter') {
    return { panel: 'filter', source: 'tool' };
  }
  if (activeTool === 'redact') {
    return { panel: 'redact', source: 'tool' };
  }
  if (activeTool === 'sticker') {
    return { panel: 'sticker', source: 'tool' };
  }

  return null;
}
