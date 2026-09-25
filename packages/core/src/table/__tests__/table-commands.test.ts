import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { runTableCommandAt } from '../actions';

function createMockEditor(size: number) {
  const chain = {
    focus: vi.fn(() => chain),
    setTextSelection: vi.fn(() => chain),
    addColumnBefore: vi.fn(() => chain),
    run: vi.fn(() => true),
  };
  const editor = {
    state: { doc: { content: { size } } },
    chain: vi.fn(() => chain),
  } as unknown as Editor;
  return { editor, chain };
}

describe('runTableCommandAt position guard', () => {
  it('clamps an out-of-range pos instead of throwing', () => {
    const { editor, chain } = createMockEditor(10);
    expect(runTableCommandAt(editor, 9999, 'addColumnBefore')).toBe(true);
    expect(chain.setTextSelection).toHaveBeenCalledWith(10);
  });

  it('clamps a negative pos to 0', () => {
    const { editor, chain } = createMockEditor(10);
    expect(runTableCommandAt(editor, -4, 'addColumnBefore')).toBe(true);
    expect(chain.setTextSelection).toHaveBeenCalledWith(0);
  });

  it('returns false for a non-finite pos without touching the chain', () => {
    const { editor, chain } = createMockEditor(10);
    expect(runTableCommandAt(editor, Number.NaN, 'addColumnBefore')).toBe(false);
    expect(chain.setTextSelection).not.toHaveBeenCalled();
  });
});
