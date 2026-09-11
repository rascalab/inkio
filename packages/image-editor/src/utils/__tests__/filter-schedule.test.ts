import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Konva from 'konva';
import {
  cancelScheduledFilterPreview,
  DEFAULT_FINETUNE,
  scheduleFilteredPreview,
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
    cache: ReturnType<typeof vi.fn>;
    brightness: ReturnType<typeof vi.fn>;
  };
}

describe('scheduleFilteredPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let nextId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, cb);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      callbacks.delete(id);
    }));
    (globalThis as unknown as { __flushRaf: () => void }).__flushRaf = () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const cb of pending) cb(0);
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function flushRaf(): void {
    (globalThis as unknown as { __flushRaf: () => void }).__flushRaf();
  }

  it('coalesces rapid slider ticks into a single cache() per frame', () => {
    const node = createMockNode();
    for (let i = 0; i < 10; i += 1) {
      scheduleFilteredPreview(node, 'none', { ...DEFAULT_FINETUNE, brightness: i / 10 });
    }
    expect(node.cache).not.toHaveBeenCalled();
    flushRaf();
    expect(node.cache).toHaveBeenCalledTimes(1);
  });

  it('applies the latest values when the frame runs', () => {
    const node = createMockNode();
    scheduleFilteredPreview(node, 'none', { ...DEFAULT_FINETUNE, brightness: 0.1 });
    scheduleFilteredPreview(node, 'none', { ...DEFAULT_FINETUNE, brightness: 0.9 });
    flushRaf();
    expect(node.brightness).toHaveBeenLastCalledWith(0.9);
    expect(node.cache).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending preview without touching the node', () => {
    const node = createMockNode();
    scheduleFilteredPreview(node, 'grayscale');
    cancelScheduledFilterPreview(node);
    flushRaf();
    expect(node.cache).not.toHaveBeenCalled();
  });

  it('schedules again after a frame has flushed', () => {
    const node = createMockNode();
    scheduleFilteredPreview(node, 'none', { ...DEFAULT_FINETUNE, brightness: 0.1 });
    flushRaf();
    scheduleFilteredPreview(node, 'none', { ...DEFAULT_FINETUNE, brightness: 0.2 });
    flushRaf();
    expect(node.cache).toHaveBeenCalledTimes(2);
    expect(node.brightness).toHaveBeenLastCalledWith(0.2);
  });
});
