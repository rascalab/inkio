interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

import { clampNumber as clamp } from './math';

function clampChannel(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

export function rgbaToCss({ r, g, b, a }: RgbaColor): string {
  if (a >= 0.999) {
    return rgbToHex({ r, g, b, a });
  }

  return `rgba(${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(b)}, ${Number(a.toFixed(3))})`;
}

export function rgbToHex({ r, g, b, a }: RgbaColor): string {
  const alpha = clamp(a, 0, 1);
  const base = `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;
  if (alpha >= 0.999) {
    return base;
  }

  return `${base}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export function parseColor(value: string): RgbaColor | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'transparent') {
    return { r: 255, g: 255, b: 255, a: 0 };
  }

  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const alpha = hex.length === 4 ? parseInt(`${hex[3]}${hex[3]}`, 16) / 255 : 1;
      return {
        r: parseInt(`${hex[0]}${hex[0]}`, 16),
        g: parseInt(`${hex[1]}${hex[1]}`, 16),
        b: parseInt(`${hex[2]}${hex[2]}`, 16),
        a: alpha,
      };
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const match = normalized.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:\s*[,/]\s*([0-9.]+))?\s*\)$/i);
  if (!match) {
    return null;
  }

  return {
    r: clampChannel(Number(match[1])),
    g: clampChannel(Number(match[2])),
    b: clampChannel(Number(match[3])),
    a: clamp(match[4] ? Number(match[4]) : 1, 0, 1),
  };
}

export function rgbaToHsva({ r, g, b, a }: RgbaColor): HsvaColor {
  const rr = clamp(r, 0, 255) / 255;
  const gg = clamp(g, 0, 255) / 255;
  const bb = clamp(b, 0, 255) / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rr) {
      h = 60 * (((gg - bb) / delta) % 6);
    } else if (max === gg) {
      h = 60 * (((bb - rr) / delta) + 2);
    } else {
      h = 60 * (((rr - gg) / delta) + 4);
    }
  }

  return {
    h: (h + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
    a: clamp(a, 0, 1),
  };
}

export function hsvaToRgba({ h, s, v, a }: HsvaColor): RgbaColor {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);
  const chroma = value * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = value - chroma;

  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (segment >= 0 && segment < 1) {
    rr = chroma;
    gg = x;
  } else if (segment < 2) {
    rr = x;
    gg = chroma;
  } else if (segment < 3) {
    gg = chroma;
    bb = x;
  } else if (segment < 4) {
    gg = x;
    bb = chroma;
  } else if (segment < 5) {
    rr = x;
    bb = chroma;
  } else {
    rr = chroma;
    bb = x;
  }

  return {
    r: clampChannel((rr + m) * 255),
    g: clampChannel((gg + m) * 255),
    b: clampChannel((bb + m) * 255),
    a: clamp(a, 0, 1),
  };
}

export function normalizeColor(value: string): string {
  if (value.trim().toLowerCase() === 'transparent') {
    return 'transparent';
  }

  const parsed = parseColor(value);
  return parsed ? rgbaToCss(parsed).toLowerCase() : value.trim().toLowerCase();
}

export function hsvaToCss(hsva: HsvaColor): string {
  return rgbaToCss(hsvaToRgba(hsva));
}

export function colorToHsva(value: string, fallback = '#111827'): HsvaColor {
  return rgbaToHsva(parseColor(value) ?? parseColor(fallback) ?? { r: 17, g: 24, b: 39, a: 1 });
}
