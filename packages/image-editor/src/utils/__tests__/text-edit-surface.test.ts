import { describe, expect, it } from 'vitest';
import { getTextEditSurface } from '../text-edit-surface';

describe('getTextEditSurface', () => {
  it('returns a non-white glass surface in dark mode', () => {
    const surface = getTextEditSurface('dark');

    expect(surface.background).toBe('rgba(15, 23, 42, 0.78)');
    expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(surface.background).not.toContain('255, 255, 255, 0.98');
  });

  it('returns an opaque-enough light glass surface in light mode', () => {
    const surface = getTextEditSurface('light');

    expect(surface.background).toBe('rgba(255, 250, 245, 0.82)');
    expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
  });
});
