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

let _cache: IEColors | null = null;
let _cacheTheme: string | null | undefined;

/** Resolve image-editor colors from CSS variables.
 *  Results are cached and only re-resolved when the theme attribute changes. */
export function getIEColors(): IEColors {
  if (typeof document === 'undefined') return FALLBACK_COLORS;
  const root = document.querySelector('.inkio-ie-portal-theme') ?? document.querySelector('.inkio');
  if (!root) return _cache ?? FALLBACK_COLORS;
  const dataTheme = root.getAttribute('data-theme') ?? '';
  const cacheKey = dataTheme;
  if (_cache && cacheKey === _cacheTheme) return _cache;
  _cacheTheme = cacheKey;
  _cache = {
    selection: getCssVar(root, '--inkio-selection-bg', '#c2e5ff'),
    primary: getCssVar(root, '--inkio-primary', '#0090ff'),
    handle: getCssVar(root, '--inkio-overlay-text', '#ffffff'),
    cropOverlay: getCssVar(root, '--inkio-overlay-bg', 'rgba(0,0,0,0.5)'),
    canvasBg: getCssVar(root, '--inkio-ie-canvas-bg', '#fcfcfd'),
    textEditBorder: getCssVar(root, '--inkio-border-focus', '#3b82f6'),
  };
  return _cache;
}

/* ---- Cursor helpers (hoisted to avoid per-render allocations) ---- */

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const stage = e.target.getStage();
  if (stage) stage.container().style.cursor = cursor;
}

export const handleCursorPointer = (e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'pointer');
export const handleCursorDefault = (e: Konva.KonvaEventObject<MouseEvent>) => setCursor(e, 'default');
