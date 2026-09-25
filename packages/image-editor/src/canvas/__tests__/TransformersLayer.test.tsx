// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransformersLayer } from '../TransformersLayer';

const { attachedIds } = vi.hoisted(() => ({ attachedIds: [] as unknown[] }));

const fakeTransformer = {
  nodes: (list?: unknown[]) => {
    if (list) attachedIds.push(list);
  },
  getLayer: () => ({ batchDraw: () => {} }),
};

vi.mock('react-konva', () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Transformer: React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useEffect(() => {
      if (typeof ref === 'function') {
        ref(fakeTransformer);
      } else if (ref) {
        (ref as React.MutableRefObject<unknown>).current = fakeTransformer;
      }
    });
    return <div />;
  }),
}));

afterEach(() => {
  cleanup();
  attachedIds.length = 0;
});

function stageWith(ids: string[]) {
  const nodes = ids.map((id) => ({ id: () => id }));
  return {
    current: {
      find: (predicate: (node: { id: () => string }) => boolean) =>
        nodes.filter(predicate),
      container: () => document.createElement('div'),
    },
  };
}

/**
 * Transformer attach must not depend on CSS selector syntax: annotation ids
 * may contain spaces, dots, colons, or quotes.
 */
describe('TransformersLayer id matching', () => {
  it('attaches to ids containing selector-significant characters', () => {
    const specialId = 'a.b:c d"e';
    render(
      <TransformersLayer
        selectedAnnotationId={specialId}
        stageRef={stageWith(['other', specialId]) as never}
      />,
    );

    expect(attachedIds).toHaveLength(1);
    expect((attachedIds[0] as Array<{ id: () => string }>).map((node) => node.id())).toEqual([
      specialId,
    ]);
  });

  it('clears the transformer when nothing matches', () => {
    render(
      <TransformersLayer selectedAnnotationId="missing" stageRef={stageWith(['a']) as never} />,
    );

    expect(attachedIds).toEqual([[]]);
  });
});
