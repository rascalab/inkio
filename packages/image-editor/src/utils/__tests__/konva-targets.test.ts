import { describe, expect, it } from 'vitest';
import { isTransformerInteraction } from '../konva-targets';

interface FakeNode {
  getClassName?: () => string;
  getParent: () => FakeNode | null;
}

function makeNode(className: string, parent: FakeNode | null = null): FakeNode {
  return {
    getClassName: () => className,
    getParent: () => parent,
  };
}

describe('isTransformerInteraction', () => {
  it('returns true when the target is inside a transformer tree', () => {
    const transformer = makeNode('Transformer');
    const anchor = makeNode('Rect', transformer);

    expect(isTransformerInteraction(anchor as never)).toBe(true);
  });

  it('returns false for ordinary annotation nodes', () => {
    const group = makeNode('Group');
    const rect = makeNode('Rect', group);

    expect(isTransformerInteraction(rect as never)).toBe(false);
  });
});
