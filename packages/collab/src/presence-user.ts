import type { CollabUser } from './provider';

export const FALLBACK_PRESENCE_USER: CollabUser = { name: 'Anonymous', color: '#888888' };

/** Awareness is display metadata, not a trusted account identity. */
export function normalizePresenceUser(value: unknown): CollabUser | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const { name, color } = value as { name?: unknown; color?: unknown };
  if (typeof name !== 'string') return undefined;
  const label = name.slice(0, 80).replace(/[\p{Cc}\p{Cf}]+/gu, '').trim();
  if (!label) return undefined;
  let displayColor = FALLBACK_PRESENCE_USER.color;
  if (typeof color === 'string') {
    if (/^#[\da-f]{6}$/i.test(color)) displayColor = color;
    else if (/^#[\da-f]{3}$/i.test(color)) {
      displayColor = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
  }
  return { name: label, color: displayColor };
}
