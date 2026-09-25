import type { Editor } from '@tiptap/core';
import {
  filterSlashCommandItems,
  resolveSlashCommandItems,
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

describe('resolveSlashCommandItems error contract', () => {
  const { editor } = createMockEditor();
  const injected = { id: 'x', label: 'Xray', command: () => {} };

  it('reports a throwing items() via onError and yields []', async () => {
    const onError = vi.fn();
    const result = await resolveSlashCommandItems(
      { query: '', editor },
      {
        items: () => Promise.reject(new Error('boom')),
        transformItems: undefined,
        onError,
        latest: { value: 0 },
      },
    );

    expect(result).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toMatchObject({
      source: 'slashCommand.suggestion',
      recoverable: true,
    });
  });

  it('still applies transformItems over an empty base', async () => {
    const result = await resolveSlashCommandItems(
      { query: '', editor },
      {
        items: () => [],
        transformItems: () => [injected],
        onError: undefined,
        latest: { value: 0 },
      },
    );

    expect(result).toEqual([injected]);
  });

  it('drops a superseded sequence so slow responses never overwrite', async () => {
    const latest = { value: 0 };
    let release!: (value: SlashCommandItem[]) => void;
    const gate = new Promise<SlashCommandItem[]>((resolve) => {
      release = resolve;
    });
    const source = {
      items: () => gate,
      transformItems: undefined,
      onError: undefined,
      latest,
    };
    const first = resolveSlashCommandItems({ query: '', editor }, source);
    const second = resolveSlashCommandItems({ query: '', editor }, source);
    release([injected]);
    const [stale, fresh] = await Promise.all([first, second]);

    expect(stale).toEqual([]);
    expect(fresh).toEqual([injected]);
  });
});
