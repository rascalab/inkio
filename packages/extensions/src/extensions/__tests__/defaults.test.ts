import { getDefaultInkioExtensions } from '../defaults';

describe('defaults', () => {
  it('getDefaultInkioExtensions should include imageBlock', () => {
    const extensions = getDefaultInkioExtensions();
    const names = extensions.map((ext: any) => ext.name);
    expect(names).toContain('imageBlock');
  });

  it('getDefaultInkioExtensions should include mention/slash/callout/wikilink by default', () => {
    const extensions = getDefaultInkioExtensions();
    const names = extensions.map((ext: any) => ext.name);
    expect(names).toContain('mention');
    expect(names).toContain('slashCommand');
    expect(names).toContain('callout');
    expect(names).toContain('wikiLink');
  });

  it('getDefaultInkioExtensions should include hashtag when hashtagItems is provided', () => {
    const extensions = getDefaultInkioExtensions({
      hashtagItems: () => [],
    });
    const names = extensions.map((ext: any) => ext.name);
    expect(names).toContain('hashTag');
  });

  it('getDefaultInkioExtensions should include core base extensions', () => {
    const extensions = getDefaultInkioExtensions();
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('doc');
    expect(names).toContain('paragraph');
    expect(names).toContain('text');
    expect(names).toContain('bold');
  });
});
