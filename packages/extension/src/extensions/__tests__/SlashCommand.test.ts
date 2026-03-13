import type { Editor, Range } from '@tiptap/core';
import { SlashCommand, SlashCommandItem, defaultSlashCommands } from '../SlashCommand/SlashCommand';

function createMockEditor(commandName?: string) {
  const chain = {
    focus: vi.fn(() => chain),
    deleteRange: vi.fn(() => chain),
    run: vi.fn(() => true),
  } as Record<string, any>;

  if (commandName) {
    chain[commandName] = vi.fn(() => chain);
  }

  const editor = {
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

    const { editor, chain } = createMockEditor('toggleBulletList');

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
});
