/** Image editor canvas theme — reads CSS custom properties at runtime
 *  so that Konva (canvas-based) colors stay in sync with the token system.
 *  Consumers only need to maintain tokens.css. */

import type Konva from 'konva';

/* ---- CSS variable resolver ---- */

function getCssVar(root: Element, name: string, fallback: string): string {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  return value || fallback;
}

interface IEColors {
  readonly selection: string;
  readonly primary: string;
  readonly handle: string;
  readonly cropOverlay: string;
  readonly canvasBg: string;
  readonly textEditBorder: string;
}

const FALLBACK_COLORS: IEColors = {
  selection: '#3b82f6',
  primary: '#3b82f6',
  handle: '#ffffff',
  cropOverlay: 'rgba(0,0,0,0.5)',
  canvasBg: '#fcfcfd',
  textEditBorder: '#3b82f6',
};

/**
 * Resolve image-editor colors from CSS variables. Deliberately uncached:
 * a light/dark-keyed cache goes stale on runtime token swaps, and a global
 * first-match root is wrong on multi-editor pages. Callers pass their own
 * DOM anchor when they have one (the transformer uses its stage).
 */
export function getIEColors(fromElement?: Element | null): IEColors {
  if (typeof document === 'undefined') return FALLBACK_COLORS;
  const root = fromElement?.closest('.inkio-ie-modal-content, .inkio-ie-portal-theme, .inkio')
    ?? document.querySelector('.inkio-ie-portal-theme')
    ?? document.querySelector('.inkio');
  if (!root) return FALLBACK_COLORS;
  return {
    selection: getCssVar(root, '--inkio-selection-bg', '#c2e5ff'),
    primary: getCssVar(root, '--inkio-primary', '#0090ff'),
    handle: getCssVar(root, '--inkio-overlay-text', '#ffffff'),
    cropOverlay: getCssVar(root, '--inkio-overlay-bg', 'rgba(0,0,0,0.5)'),
    canvasBg: getCssVar(root, '--inkio-ie-canvas-bg', '#fcfcfd'),
    textEditBorder: getCssVar(root, '--inkio-border-focus', '#3b82f6'),
  };
}

/* ---- Cursor helpers (hoisted to avoid per-render allocations) ---- */

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const stage = e.target.getStage();
  if (stage) stage.container().style.cursor = cursor;
}

export const handleCursorPointer = (e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'pointer');
export const handleCursorDefault = (e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'default');
