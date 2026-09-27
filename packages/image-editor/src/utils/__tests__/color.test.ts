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

  it('parses short and alpha hex forms', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#0f08')).toEqual({ r: 0, g: 255, b: 0, a: 0x88 / 255 });
    expect(parseColor('#11182780')).toEqual({ r: 17, g: 24, b: 39, a: 0x80 / 255 });
    expect(parseColor('  #ABCDEF ')).toEqual({ r: 171, g: 205, b: 239, a: 1 });
  });

  it('rejects hex with wrong lengths or partial-parse digits', () => {
    expect(parseColor('#fz0')).toBeNull();
    expect(parseColor('#fff8z')).toBeNull();
    expect(parseColor('#1234567x')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    expect(parseColor('#1234567')).toBeNull();
    expect(parseColor('#')).toBeNull();
  });

  it('parses rgb/rgba with integer, decimal and leading-dot numbers', () => {
    expect(parseColor('rgb(17, 24, 39)')).toEqual({ r: 17, g: 24, b: 39, a: 1 });
    expect(parseColor('rgba(17, 24, 39, 0.5)')).toEqual({ r: 17, g: 24, b: 39, a: 0.5 });
    expect(parseColor('rgba(17 24 39 / .25)')).toEqual({ r: 17, g: 24, b: 39, a: 0.25 });
    expect(parseColor('rgb(300, 1.6, 0)')).toEqual({ r: 255, g: 2, b: 0, a: 1 });
  });

  it('rejects other number shapes that Number() would turn into NaN', () => {
    expect(parseColor('rgba(0, 0, 0, 0.5.5)')).toBeNull();
    expect(parseColor('rgb(1.2.3, 4, 5)')).toBeNull();
    expect(parseColor('rgb(..., 4, 5)')).toBeNull();
  });

  it('keeps the placeholder-alpha pipeline in valid CSS', () => {
    const parsed = parseColor('transparent');
    expect(parsed).not.toBeNull();
    expect(rgbaToCss({ ...parsed!, a: 0x44 / 255 })).toBe('rgba(255, 255, 255, 0.267)');
  });
});
