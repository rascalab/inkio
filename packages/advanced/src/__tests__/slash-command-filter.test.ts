import type { Editor } from '@tiptap/core';
import {
  filterSlashCommandItems,
  SLASH_COMMAND_MAX_ITEMS,
  type SlashCommandItem,
} from '../extensions/SlashCommand';

function createMockEditor() {
  const editor = {
    state: { schema: { nodes: { paragraph: {} } } },
  } as unknown as Editor;
  return { editor };
}

function makeItems(count: number): SlashCommandItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i}`,
    command: () => {},
  }));
}

describe('filterSlashCommandItems result limit', () => {
  const { editor } = createMockEditor();

  it('caps results at SLASH_COMMAND_MAX_ITEMS', () => {
    const result = filterSlashCommandItems(makeItems(200), '', editor);
    expect(result).toHaveLength(SLASH_COMMAND_MAX_ITEMS);
  });

  it('stops scanning once the cap is reached (early exit)', () => {
    const isAvailable = vi.fn(() => true);
    const items = makeItems(200).map((item) => ({ ...item, isAvailable }));
    const result = filterSlashCommandItems(items, '', editor);

    expect(result).toHaveLength(SLASH_COMMAND_MAX_ITEMS);
    expect(isAvailable.mock.calls.length).toBeLessThan(200);
  });

  it('still filters by query and schema availability within the cap', () => {
    const items = makeItems(10);
    const headed = filterSlashCommandItems(items, 'item 1', editor);
    expect(headed.map((item) => item.id)).toEqual(['item-1']);

    const unavailable = filterSlashCommandItems(
      items.map((item) => ({ ...item, isAvailable: () => false })),
      '',
      editor,
    );
    expect(unavailable).toHaveLength(0);
  });

  it('respects a custom limit', () => {
    expect(filterSlashCommandItems(makeItems(10), '', editor, 3)).toHaveLength(3);
    expect(filterSlashCommandItems(makeItems(10), '', editor, 0)).toHaveLength(0);
  });
});
