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

  it('rejects malformed rgb numbers instead of yielding NaN channels', () => {
    expect(parseColor('rgb(1..2, 0, 0)')).toBeNull();
    expect(parseColor('rgb(., 0, 0)')).toBeNull();
    expect(parseColor('rgba(0, 0, 0, ..5)')).toBeNull();
  });

  it('rejects truncated hex digits instead of normalizing them', () => {
    expect(parseColor('#fZ0000')).toBeNull();
    expect(parseColor('#00fZ00')).toBeNull();
    expect(parseColor('#00000g')).toBeNull();
  });

  it('keeps the placeholder-alpha pipeline in valid CSS', () => {
    const parsed = parseColor('transparent');
    expect(parsed).not.toBeNull();
    expect(rgbaToCss({ ...parsed!, a: 0x44 / 255 })).toBe('rgba(255, 255, 255, 0.267)');
  });
});
