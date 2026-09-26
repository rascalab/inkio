// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadImage } from '../image-loader';

afterEach(() => {
  vi.useRealTimers();
});

describe('loadImage', () => {
  it('rejects blocked URL schemes instead of assigning them', async () => {
    await expect(loadImage('javascript:alert(1)')).rejects.toThrow(/blocked URL scheme/);
  });

  it('shares one fetch between concurrent loads of the same src', async () => {
    vi.useFakeTimers();
    const first = loadImage('http://x.test/shared.png');
    const second = loadImage('http://x.test/shared.png');
    expect(second).toBe(first);
    const assertion = expect(first).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
  });
});
