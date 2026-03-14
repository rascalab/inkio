import type { Editor, Range } from '@tiptap/core';
import { SlashCommand, SlashCommandItem, defaultSlashCommands } from '../SlashCommand/SlashCommand';

function createMockEditor(commandNames: string[] = [], schemaNodes: string[] = []) {
  const chain = {
    focus: vi.fn(() => chain),
    deleteRange: vi.fn(() => chain),
    run: vi.fn(() => true),
  } as Record<string, any>;

  commandNames.forEach((commandName) => {
    chain[commandName] = vi.fn(() => chain);
  });

  const nodes = schemaNodes.reduce<Record<string, {}>>((acc, name) => {
    acc[name] = {};
    return acc;
  }, { paragraph: {} });

  const editor = {
    state: {
      schema: {
        nodes,
      },
    },
    chain: vi.fn(() => chain),
    commands: {},
    isDestroyed: false,
  } as unknown as Editor;

  return { editor, chain };
}

const range: Range = {
  from: 2,
  to: 4,
};

describe('SlashCommand extension', () => {
  it('should have correct name', () => {
    expect(SlashCommand.name).toBe('slashCommand');
  });

  it('SlashCommandItem icon field should accept ReactNode type', () => {
    const item: SlashCommandItem = {
      id: 'test',
      label: 'Test',
      icon: undefined, // ReactNode allows undefined
      command: () => {},
    };
    expect(item.icon).toBeUndefined();
  });

  it('should export defaultSlashCommands', async () => {
    expect(defaultSlashCommands.length).toBeGreaterThan(0);
    expect(defaultSlashCommands[0]).toHaveProperty('id');
    expect(defaultSlashCommands[0]).toHaveProperty('label');
    expect(defaultSlashCommands[0]).toHaveProperty('command');
  });

  it('runs slash commands through the optional chain helper when the command exists', () => {
    const bulletList = defaultSlashCommands.find((item) => item.id === 'bulletList');
    expect(bulletList).toBeDefined();

    const { editor, chain } = createMockEditor(['toggleBulletList']);

    bulletList!.command({ editor, range });

    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.toggleBulletList).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('does not throw or run when the target command is unavailable', () => {
    const horizontalRule = defaultSlashCommands.find((item) => item.id === 'horizontalRule');
    expect(horizontalRule).toBeDefined();

    const { editor, chain } = createMockEditor();

    expect(() => horizontalRule!.command({ editor, range })).not.toThrow();
    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.run).not.toHaveBeenCalled();
  });

  it('allows transforming default slash command items', async () => {
    const transformItems = vi.fn((defaults: SlashCommandItem[]) =>
      defaults.filter((item) => item.id !== 'image'),
    );
    const options = SlashCommand.config.addOptions?.call({
      parent: () => ({
        suggestion: {},
        items: undefined,
        transformItems,
        onError: undefined,
      }),
    } as any);

    expect(options).toBeDefined();
  });

  it('toggle list slash command uses details commands when available', () => {
    const toggleList = defaultSlashCommands.find((item) => item.id === 'toggleList');
    expect(toggleList).toBeDefined();

    const { editor, chain } = createMockEditor(['setDetails'], ['details']);

    toggleList!.command({ editor, range });

    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.setDetails).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('toggle list slash command is a safe no-op without details nodes', () => {
    const toggleList = defaultSlashCommands.find((item) => item.id === 'toggleList');
    expect(toggleList).toBeDefined();

    const { editor, chain } = createMockEditor();

    expect(() => toggleList!.command({ editor, range })).not.toThrow();
    expect(chain.run).not.toHaveBeenCalled();
  });

  it('table slash command inserts the default 3x3 table through insertTable', () => {
    const table = defaultSlashCommands.find((item) => item.id === 'table');
    expect(table).toBeDefined();

    const { editor, chain } = createMockEditor(['insertTable'], ['table']);

    table!.command({ editor, range });

    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('table slash command is a safe no-op without the table extension', () => {
    const table = defaultSlashCommands.find((item) => item.id === 'table');
    expect(table).toBeDefined();

    const { editor, chain } = createMockEditor();

    expect(() => table!.command({ editor, range })).not.toThrow();
    expect(chain.run).not.toHaveBeenCalled();
  });
});
