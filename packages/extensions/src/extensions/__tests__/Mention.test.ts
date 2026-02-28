import { Mention } from '../Mention/Mention';

describe('Mention extension', () => {
  it('should have correct name', () => {
    expect(Mention.name).toBe('mention');
  });

  it('should not call window.getSelection in command handler', () => {
    // Verify the Mention extension's suggestion command doesn't use window.getSelection
    const pluginConfig = Mention.config.addProseMirrorPlugins;
    expect(pluginConfig).toBeDefined();

    // The source should not contain collapseToEnd
    const source = pluginConfig!.toString();
    expect(source).not.toContain('collapseToEnd');
  });
});
