// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import type { Mock } from 'vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageNode } from '../ImageNode';

const konvaImageMock: Mock<(props: unknown) => null> = vi.fn((props: unknown) => {
  void props;
  return null;
});

vi.mock('react-konva', () => ({
  Image: (props: unknown) => {
    konvaImageMock(props);
    return null;
  },
}));

afterEach(() => {
  cleanup();
  konvaImageMock.mockClear();
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
