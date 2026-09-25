import { describe, expect, it } from 'vitest';
import { parseColor, rgbaToCss } from '../color';

describe('parseColor validation', () => {
  it('parses valid hex with full alpha', () => {
    expect(parseColor('#111827')).toEqual({ r: 17, g: 24, b: 39, a: 1 });
  });

  it('rejects non-hex digits instead of yielding NaN channels', () => {
    expect(parseColor('#zzzzzz')).toBeNull();
    expect(parseColor('#12xy34')).toBeNull();
    expect(parseColor('#zzz')).toBeNull();
  });

  it('keeps the placeholder-alpha pipeline in valid CSS', () => {
    const parsed = parseColor('transparent');
    expect(parsed).not.toBeNull();
    expect(rgbaToCss({ ...parsed!, a: 0x44 / 255 })).toBe('rgba(255, 255, 255, 0.267)');
  });
});
