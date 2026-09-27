import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from '../create-id';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
    expect(createId()).toBe('uuid-1');
    expect(createId('ann')).toBe('uuid-1');
  });

  it('falls back to a prefixed time + counter id that stays unique', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = Array.from({ length: 50 }, () => createId());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toMatch(/^id-[0-9a-z]+-[0-9a-z]+$/);
    expect(createId('ann')).toMatch(/^ann-[0-9a-z]+-[0-9a-z]+$/);
  });
});
