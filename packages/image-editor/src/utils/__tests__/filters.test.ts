import { describe, expect, it, vi } from 'vitest';
import Konva from 'konva';
import {
  applyImageFilter,
  DEFAULT_FINETUNE,
  FILTER_PRESETS,
  resolveEffectiveFilter,
  resolveFilterPreset,
} from '../filters';

function createMockNode() {
  return {
    brightness: vi.fn(),
    contrast: vi.fn(),
    saturation: vi.fn(),
    luminance: vi.fn(),
    enhance: vi.fn(),
    filters: vi.fn(),
    cache: vi.fn(),
    clearCache: vi.fn(),
    getLayer: vi.fn(() => null),
  } as unknown as Konva.Image & {
    brightness: ReturnType<typeof vi.fn>;
    contrast: ReturnType<typeof vi.fn>;
    saturation: ReturnType<typeof vi.fn>;
    luminance: ReturnType<typeof vi.fn>;
    enhance: ReturnType<typeof vi.fn>;
    filters: ReturnType<typeof vi.fn>;
    cache: ReturnType<typeof vi.fn>;
  };
}

describe('filter presets', () => {
  it('exposes a preset for every id including none', () => {
    const ids = FILTER_PRESETS.map((preset) => preset.id);
    expect(ids).toContain('none');
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of FILTER_PRESETS) {
      expect(preset.labelKey).toMatch(/^filter/);
    }
  });

  it('falls back to none for unknown ids', () => {
    expect(resolveFilterPreset('nope' as never).id).toBe('none');
  });

  it('applies preset values and caches the node', () => {
    const node = createMockNode();
    applyImageFilter(node, 'dramatic');

    expect(node.contrast).toHaveBeenCalledWith(32);
    expect(node.brightness).toHaveBeenCalledWith(-0.04);
    expect(node.filters).toHaveBeenCalledWith([Konva.Filters.Contrast, Konva.Filters.Brighten]);
    expect(node.cache).toHaveBeenCalled();
  });

  it('resets attrs so presets never stack', () => {
    const node = createMockNode();
    applyImageFilter(node, 'cool');
    applyImageFilter(node, 'none');

    expect(node.saturation).toHaveBeenLastCalledWith(0);
    expect(node.luminance).toHaveBeenLastCalledWith(0);
    expect(node.enhance).toHaveBeenLastCalledWith(0);
    expect(node.filters).toHaveBeenLastCalledWith([]);
  });
});

describe('finetune merging', () => {
  it('adds finetune on top of preset values', () => {
    const effective = resolveEffectiveFilter('dramatic', {
      ...DEFAULT_FINETUNE,
      brightness: 0.1,
    });

    expect(effective.values.brightness).toBeCloseTo(0.06);
    expect(effective.values.contrast).toBe(32);
  });

  it('injects missing filter stages for nonzero finetune', () => {
    const effective = resolveEffectiveFilter('none', {
      ...DEFAULT_FINETUNE,
      saturation: 0.5,
      clarity: 0.3,
    });

    expect(effective.filters).toContain(Konva.Filters.HSL);
    expect(effective.filters).toContain(Konva.Filters.Enhance);
    expect(effective.values.saturation).toBe(0.5);
  });

  it('stays empty for neutral finetune on none', () => {
    const effective = resolveEffectiveFilter('none', DEFAULT_FINETUNE);

    expect(effective.filters).toEqual([]);
    expect(effective.values).toEqual({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      luminance: 0,
      clarity: 0,
    });
  });

  it('writes merged values to the node', () => {
    const node = createMockNode();
    applyImageFilter(node, 'none', { ...DEFAULT_FINETUNE, clarity: -0.5 });

    expect(node.enhance).toHaveBeenCalledWith(-0.5);
    expect(node.filters).toHaveBeenCalledWith([Konva.Filters.Enhance]);
  });
});
