/** Resolve the owning image editor's UI colors for Konva's selection handles. */

import type Konva from 'konva';

interface IEColors {
  readonly handle: string;
  readonly primary: string;
}

const FALLBACK_COLORS: IEColors = {
  primary: '#0090ff',
  handle: '#ffffff',
};

/** Read from the stage so overrides on its nearest DOM ancestor win. */
export function getIEColors(fromElement?: Element | null): IEColors {
  if (!fromElement) return FALLBACK_COLORS;
  const style = getComputedStyle(fromElement);
  return {
    primary: style.getPropertyValue('--inkio-primary').trim() || FALLBACK_COLORS.primary,
    handle: style.getPropertyValue('--inkio-overlay-text').trim() || FALLBACK_COLORS.handle,
  };
}

/* ---- Cursor helpers (hoisted to avoid per-render allocations) ---- */

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const stage = e.target.getStage();
  if (stage) stage.container().style.cursor = cursor;
}

export const handleCursorPointer = (e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'pointer');
export const handleCursorDefault = (e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'default');
