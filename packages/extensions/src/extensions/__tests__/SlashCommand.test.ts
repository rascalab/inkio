import { SlashCommand, SlashCommandItem } from '../SlashCommand/SlashCommand';

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
    const { defaultSlashCommands } = await import('../SlashCommand/SlashCommand');
    expect(defaultSlashCommands.length).toBeGreaterThan(0);
    expect(defaultSlashCommands[0]).toHaveProperty('id');
    expect(defaultSlashCommands[0]).toHaveProperty('label');
    expect(defaultSlashCommands[0]).toHaveProperty('command');
  });
});
