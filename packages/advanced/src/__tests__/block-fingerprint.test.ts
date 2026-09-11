import { fingerprintBlockAt, isExpectedBlock } from '../extensions/BlockHandle';

function stubNode(overrides = {}) {
  return {
    type: { name: 'paragraph' },
    nodeSize: 12,
    textContent: 'Hello world',
    isText: false,
    isInline: false,
    ...overrides,
  };
}

describe('block fingerprint identity', () => {
  it('captures type, size, and text prefix at open time', () => {
    const doc = { nodeAt: () => stubNode() };
    expect(fingerprintBlockAt(doc, 5)).toEqual({
      type: 'paragraph',
      size: 12,
      textPrefix: 'Hello world',
    });
  });

  it('returns null when no node exists at the position', () => {
    expect(fingerprintBlockAt({ nodeAt: () => null }, 5)).toBeNull();
  });

  it('accepts the same block', () => {
    const fp = { type: 'paragraph', size: 12, textPrefix: 'Hello world' };
    expect(isExpectedBlock(stubNode(), fp)).toBe(true);
  });

  it('rejects an adjacent block with different content (stale pos)', () => {
    const fp = { type: 'paragraph', size: 12, textPrefix: 'Hello world' };
    expect(isExpectedBlock(stubNode({ textContent: 'Adjacent block' }), fp)).toBe(false);
  });

  it('rejects a different block type at the same position', () => {
    const fp = { type: 'paragraph', size: 12, textPrefix: 'Hello world' };
    expect(isExpectedBlock(stubNode({ type: { name: 'heading' } }), fp)).toBe(false);
  });

  it('rejects inline/text nodes even without a fingerprint', () => {
    expect(isExpectedBlock(stubNode({ isText: true, isInline: true }), null)).toBe(false);
    expect(isExpectedBlock(stubNode(), null)).toBe(true);
    expect(isExpectedBlock(null, { type: 'paragraph', size: 12, textPrefix: 'x' })).toBe(false);
  });
});
