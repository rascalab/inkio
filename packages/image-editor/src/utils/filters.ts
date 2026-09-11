import Konva from 'konva';
import type { FilterPresetId, FinetuneOptions, ImageEditorLocale } from '../types';

// Same type Konva itself uses for `Filters.*` values (`FilterFunction | string`).
type KonvaFilter = typeof Konva.Filters.Grayscale;

export interface FilterValues {
  brightness: number;
  contrast: number;
  saturation: number;
  luminance: number;
  clarity: number;
}

export const ZERO_FILTER_VALUES: Readonly<FilterValues> = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  luminance: 0,
  clarity: 0,
});

export const DEFAULT_FINETUNE: Readonly<FinetuneOptions> = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  clarity: 0,
});

export interface FilterPreset {
  id: FilterPresetId;
  labelKey: Extract<
    keyof ImageEditorLocale,
    | 'filterNone'
    | 'filterGrayscale'
    | 'filterSepia'
    | 'filterInvert'
    | 'filterWarm'
    | 'filterCool'
    | 'filterDramatic'
    | 'filterSoft'
    | 'filterVintage'
  >;
  /** Structural filters without tunable params. */
  filters: KonvaFilter[];
  /** Base values merged with user finetune (additive). */
  values: Partial<FilterValues>;
}

export const FILTER_PRESETS: readonly FilterPreset[] = [
  { id: 'none', labelKey: 'filterNone', filters: [], values: {} },
  { id: 'grayscale', labelKey: 'filterGrayscale', filters: [Konva.Filters.Grayscale], values: {} },
  { id: 'sepia', labelKey: 'filterSepia', filters: [Konva.Filters.Sepia], values: {} },
  { id: 'invert', labelKey: 'filterInvert', filters: [Konva.Filters.Invert], values: {} },
  {
    id: 'warm',
    labelKey: 'filterWarm',
    filters: [Konva.Filters.HSL, Konva.Filters.Brighten],
    values: { saturation: 0.35, luminance: 0.04, brightness: 0.05 },
  },
  {
    id: 'cool',
    labelKey: 'filterCool',
    filters: [Konva.Filters.HSL, Konva.Filters.Brighten],
    values: { saturation: 0.15, luminance: -0.03, brightness: 0.04 },
  },
  {
    id: 'dramatic',
    labelKey: 'filterDramatic',
    filters: [Konva.Filters.Contrast, Konva.Filters.Brighten],
    values: { contrast: 32, brightness: -0.04 },
  },
  {
    id: 'soft',
    labelKey: 'filterSoft',
    filters: [Konva.Filters.Brighten, Konva.Filters.Contrast],
    values: { brightness: 0.1, contrast: -12 },
  },
  {
    id: 'vintage',
    labelKey: 'filterVintage',
    filters: [Konva.Filters.Sepia, Konva.Filters.Contrast, Konva.Filters.Brighten],
    values: { contrast: -8, brightness: 0.05 },
  },
];

const PRESET_MAP: ReadonlyMap<FilterPresetId, FilterPreset> = new Map(
  FILTER_PRESETS.map((preset) => [preset.id, preset]),
);

export function resolveFilterPreset(id: FilterPresetId): FilterPreset {
  return PRESET_MAP.get(id) ?? PRESET_MAP.get('none')!;
}

export interface EffectiveFilter {
  filters: KonvaFilter[];
  values: FilterValues;
}

/** Merge preset base values with user finetune (additive per channel). */
export function resolveEffectiveFilter(
  id: FilterPresetId,
  finetune: FinetuneOptions = DEFAULT_FINETUNE,
): EffectiveFilter {
  const preset = resolveFilterPreset(id);
  const values: FilterValues = {
    brightness: (preset.values.brightness ?? 0) + finetune.brightness,
    contrast: (preset.values.contrast ?? 0) + finetune.contrast,
    saturation: (preset.values.saturation ?? 0) + finetune.saturation,
    luminance: preset.values.luminance ?? 0,
    clarity: finetune.clarity,
  };

  const filters = [...preset.filters];
  const has = (filter: KonvaFilter) => filters.includes(filter);
  if (values.brightness !== 0 && !has(Konva.Filters.Brighten)) {
    filters.push(Konva.Filters.Brighten);
  }
  if (values.contrast !== 0 && !has(Konva.Filters.Contrast)) {
    filters.push(Konva.Filters.Contrast);
  }
  if (values.saturation !== 0 && !has(Konva.Filters.HSL)) {
    filters.push(Konva.Filters.HSL);
  }
  if (values.clarity !== 0) {
    filters.push(Konva.Filters.Enhance);
  }

  return { filters, values };
}

/** Reset tunable filter attrs so switching presets never stacks values. */
function resetFilterAttrs(node: Konva.Image): void {
  node.brightness(0);
  node.contrast(0);
  node.saturation(0);
  node.luminance(0);
  node.enhance(0);
}

/**
 * Apply preset + finetune to a Konva image node and (re)cache it — caching
 * is required for Konva filters to take effect. Used by both the live
 * preview (ImageNode) and the offscreen export stage, keeping them identical.
 */
export function applyImageFilter(
  node: Konva.Image,
  id: FilterPresetId,
  finetune: FinetuneOptions = DEFAULT_FINETUNE,
): void {
  const { filters, values } = resolveEffectiveFilter(id, finetune);
  resetFilterAttrs(node);
  node.brightness(values.brightness);
  node.contrast(values.contrast);
  node.saturation(values.saturation);
  node.luminance(values.luminance);
  node.enhance(values.clarity);
  node.filters(filters);
  node.cache();
  node.getLayer()?.batchDraw();
}

interface PendingFilterPreview {
  frame: number;
  id: FilterPresetId;
  finetune: FinetuneOptions;
}

const pendingFilterPreviews = new WeakMap<Konva.Image, PendingFilterPreview>();

/**
 * Coalesced preview path for slider drags: rapid `SET_FINETUNE` ticks only
 * schedule one `cache()` (the expensive pixel pass) per animation frame,
 * always with the latest values. Export still uses `applyImageFilter`
 * synchronously so output never depends on frame timing.
 */
export function scheduleFilteredPreview(
  node: Konva.Image,
  id: FilterPresetId,
  finetune: FinetuneOptions = DEFAULT_FINETUNE,
): void {
  const pending = pendingFilterPreviews.get(node);
  if (pending) {
    pending.id = id;
    pending.finetune = finetune;
    return;
  }
  const frame = requestAnimationFrame(() => {
    const latest = pendingFilterPreviews.get(node);
    pendingFilterPreviews.delete(node);
    applyImageFilter(node, latest?.id ?? id, latest?.finetune ?? finetune);
  });
  pendingFilterPreviews.set(node, { frame, id, finetune });
}

export function cancelScheduledFilterPreview(node: Konva.Image): void {
  const pending = pendingFilterPreviews.get(node);
  if (pending) {
    cancelAnimationFrame(pending.frame);
    pendingFilterPreviews.delete(node);
  }
}
