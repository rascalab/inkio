// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react';
import { useEffect, useMemo } from 'react';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageNode } from '../ImageNode';
import type { Transform } from '../../types';

interface SpyNode {
  brightness: ReturnType<typeof vi.fn>;
  contrast: ReturnType<typeof vi.fn>;
  saturation: ReturnType<typeof vi.fn>;
  luminance: ReturnType<typeof vi.fn>;
  enhance: ReturnType<typeof vi.fn>;
  filters: ReturnType<typeof vi.fn>;
  cache: ReturnType<typeof vi.fn>;
  clearCache: ReturnType<typeof vi.fn>;
  getLayer: () => { batchDraw: ReturnType<typeof vi.fn> };
}

function createSpyNode(): SpyNode {
  return {
    brightness: vi.fn(),
    contrast: vi.fn(),
    saturation: vi.fn(),
    luminance: vi.fn(),
    enhance: vi.fn(),
    filters: vi.fn(),
    cache: vi.fn(),
    clearCache: vi.fn(),
    getLayer: () => ({ batchDraw: vi.fn() }),
  };
}

const mountedNodes: SpyNode[] = [];

const konvaImageMock: Mock<(props: unknown) => null> = vi.fn(() => null);

vi.mock('react-konva', () => ({
  Image: (props: unknown) => {
    // Faithful lifecycles: one stable node per mount, ref attached on mount
    // only — no eager re-assign during updates, mirroring real React.
    const node = useMemo(() => {
      const created = createSpyNode();
      mountedNodes.push(created);
      return created;
    }, []);
    const ref = (props as { ref?: unknown }).ref as
      | undefined
      | ((node: SpyNode | null) => void)
      | { current: SpyNode | null };
    useEffect(() => {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      return () => {
        if (typeof ref === 'function') ref(null);
        else if (ref) ref.current = null;
      };
    }, []);
    konvaImageMock(props);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  konvaImageMock.mockClear();
  mountedNodes.length = 0;
  vi.unstubAllGlobals();
});

describe('ImageNode', () => {
  it('uses pre-rotation display dimensions for quarter-turns', () => {
    render(
      <ImageNode
        image={{} as HTMLImageElement}

        displayWidth={180}
        displayHeight={320}
        transform={{
          rotation: 90,
          flipX: false,
          flipY: false,
          crop: null,
        }}
      />,
    );

    expect(konvaImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 320,
        height: 180,
        scaleX: 1,
        scaleY: 1,
        x: 90,
        y: 160,
      }),
    );
  });

  it('keeps cropped images anchored to the pre-rotation frame', () => {
    render(
      <ImageNode
        image={{} as HTMLImageElement}

        displayWidth={100}
        displayHeight={200}
        transform={{
          rotation: 90,
          flipX: false,
          flipY: false,
          crop: {
            x: 20,
            y: 10,
            width: 200,
            height: 100,
          },
        }}
      />,
    );

    expect(konvaImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 200,
        height: 100,
        offsetX: 100,
        offsetY: 50,
        x: 50,
        y: 100,
      }),
    );
  });
});

const BASE_TRANSFORM: Transform = {
  rotation: 0,
  flipX: false,
  flipY: false,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

describe('ImageNode filter cache', () => {
  // Stable across renders: a fresh image identity per render would retrigger
  // the effect through the `image` dep and mask a missing crop dep.
  const stubImage = {} as HTMLImageElement;
  beforeEach(() => {
    // Run the preview scheduler synchronously: this jsdom setup never ticks
    // rAF, and the behavior under test is effect wiring (deps), not the
    // coalescing in scheduleFilteredPreview.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  it('recaches when a same-size crop is moved', async () => {
    const { rerender, unmount } = render(
      <ImageNode
        image={stubImage}
        displayWidth={200}
        displayHeight={200}
        transform={BASE_TRANSFORM}
        filter="grayscale"
      />,
    );
    try {
      await waitFor(() => {
        expect(mountedNodes[0]?.cache).toHaveBeenCalled();
      });
      const callsAfterFirst = mountedNodes[0].cache.mock.calls.length;

      rerender(
        <ImageNode
          image={stubImage}
          displayWidth={200}
          displayHeight={200}
          transform={{
            ...BASE_TRANSFORM,
            crop: { x: 10, y: 5, width: 100, height: 100 },
          }}
          filter="grayscale"
        />,
      );
      await waitFor(() => {
        expect(mountedNodes[0].cache.mock.calls.length).toBeGreaterThan(callsAfterFirst);
      });
    } finally {
      unmount();
    }
  });
});
