// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignLayer } from '../DesignLayer';
import { initialState } from '../../reducer';

vi.mock('react-konva', () => ({
  Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
  Group: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../ImageNode', () => ({
  ImageNode: () => <div data-testid="image-node" />,
}));

vi.mock('../../annotations/AnnotationRenderer', () => ({
  AnnotationRenderer: ({ annotation }: any) => (
    <div data-testid="annotation-order">{annotation.id}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('DesignLayer', () => {
  it('renders annotations in array order so later items stay visually on top', () => {
    render(
      <DesignLayer
        state={{
          ...initialState,
          originalImage: {} as HTMLImageElement,
          originalWidth: 800,
          originalHeight: 600,
          annotations: [
            {
              id: 'bottom',
              type: 'rect',
              x: 10,
              y: 20,
              width: 120,
              height: 80,
              fill: '#ef4444',
              stroke: '#111827',
              strokeWidth: 2,
              rotation: 0,
            },
            {
              id: 'top',
              type: 'rect',
              x: 30,
              y: 40,
              width: 120,
              height: 80,
              fill: '#3b82f6',
              stroke: '#111827',
              strokeWidth: 2,
              rotation: 0,
            },
          ],
        }}
        displayWidth={800}
        displayHeight={600}
        scale={1}
        onSelectAnnotation={vi.fn()}
        onChangeAnnotation={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('annotation-order').map((node) => node.textContent)).toEqual([
      'bottom',
      'top',
    ]);
  });
});
