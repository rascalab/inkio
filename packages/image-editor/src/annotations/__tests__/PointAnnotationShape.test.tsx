// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArrowAnnotationShape } from '../ArrowAnnotationShape';
import { FreeDrawAnnotationShape } from '../FreeDrawAnnotationShape';

interface MutableNodeState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

function createMutableNode(initial: MutableNodeState) {
  const state = { ...initial };
  return {
    state,
    x: (value?: number) => (value === undefined ? state.x : (state.x = value)),
    y: (value?: number) => (value === undefined ? state.y : (state.y = value)),
    scaleX: (value?: number) => (value === undefined ? state.scaleX : (state.scaleX = value)),
    scaleY: (value?: number) => (value === undefined ? state.scaleY : (state.scaleY = value)),
    rotation: (value?: number) => (value === undefined ? state.rotation : (state.rotation = value)),
  };
}

let arrowNode = createMutableNode({ x: 40, y: 20, scaleX: 1.5, scaleY: 0.5, rotation: 0 });
let lineNode = createMutableNode({ x: 24, y: 12, scaleX: 2, scaleY: 1, rotation: 0 });
let latestArrowProps: any = null;
let latestLineProps: any = null;

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Arrow: React.forwardRef((props: any, ref: React.ForwardedRef<unknown>) => {
      latestArrowProps = props;
      React.useImperativeHandle(ref, () => arrowNode);
      return <div data-testid="arrow-shape" />;
    }),
    Line: React.forwardRef((props: any, ref: React.ForwardedRef<unknown>) => {
      latestLineProps = props;
      React.useImperativeHandle(ref, () => lineNode);
      return <div data-testid="line-shape" />;
    }),
  };
});

afterEach(() => {
  cleanup();
  latestArrowProps = null;
  latestLineProps = null;
  arrowNode = createMutableNode({ x: 40, y: 20, scaleX: 1.5, scaleY: 0.5, rotation: 0 });
  lineNode = createMutableNode({ x: 24, y: 12, scaleX: 2, scaleY: 1, rotation: 0 });
});

describe('point annotation transform handlers', () => {
  it('commits transformed arrow points and resets the node transform', () => {
    const onChange = vi.fn();

    render(
      <ArrowAnnotationShape
        annotation={{
          id: 'arrow-1',
          type: 'arrow',
          points: [10, 20, 30, 40],
          stroke: '#111827',
          strokeWidth: 4,
        }}
        onSelect={vi.fn()}
        onChange={onChange}
        scale={2}
      />,
    );

    latestArrowProps.onTransformEnd();

    expect(onChange).toHaveBeenCalledWith('arrow-1', {
      points: [35, 20, 65, 30],
    });
    expect(arrowNode.state).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
  });

  it('commits transformed free-draw points and resets the node transform', () => {
    const onChange = vi.fn();

    render(
      <FreeDrawAnnotationShape
        annotation={{
          id: 'draw-1',
          type: 'freedraw',
          points: [5, 5, 15, 10, 25, 20],
          stroke: '#2563eb',
          strokeWidth: 6,
          opacity: 1,
        }}
        onSelect={vi.fn()}
        onChange={onChange}
        scale={2}
      />,
    );

    latestLineProps.onTransformEnd();

    expect(onChange).toHaveBeenCalledWith('draw-1', {
      points: [22, 11, 42, 16, 62, 26],
    });
    expect(lineNode.state).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
  });
});
