import { getDefaultInkioExtensions } from '../defaults';
import { isExtensionsAdapter } from '../../adapter';

describe('getDefaultInkioExtensions — options path', () => {
  it('returns an array of extensions', () => {
    const exts = getDefaultInkioExtensions();
    expect(Array.isArray(exts)).toBe(true);
    expect(exts.length).toBeGreaterThan(0);
  });

  it('does not include Comment by default (no comment option)', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    expect(names).not.toContain('comment');
  });

  it('includes Comment when comment option is provided', () => {
    const names = getDefaultInkioExtensions({
      comment: { onCommentCreate: () => {} },
    }).map((e: any) => e.name);
    expect(names).toContain('comment');
  });

  it('does not include BlockHandle by default', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    expect(names).not.toContain('blockHandle');
  });

  it('includes BlockHandle when blockHandle: true', () => {
    const names = getDefaultInkioExtensions({ blockHandle: true }).map((e: any) => e.name);
    expect(names).toContain('blockHandle');
  });

  it('does not include hashTag by default (no hashtagItems)', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    expect(names).not.toContain('hashTag');
  });

  it('includes hashTag when hashtagItems is provided', () => {
    const names = getDefaultInkioExtensions({ hashtagItems: () => [] }).map((e: any) => e.name);
    expect(names).toContain('hashTag');
  });

  it('includes all core base extensions', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    expect(names).toContain('doc');
    expect(names).toContain('paragraph');
    expect(names).toContain('text');
    expect(names).toContain('bold');
    expect(names).toContain('imageBlock');
  });

  it('always includes SlashCommand, Callout, WikiLink, Mention', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    expect(names).toContain('slashCommand');
    expect(names).toContain('callout');
    expect(names).toContain('wikiLink');
    expect(names).toContain('mention');
  });

  it('includes ToggleList and SimpleTable', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    // ToggleList is a compound extension; its wrapper registers as 'toggleListExtension'
    expect(names).toContain('toggleListExtension');
    expect(names).toContain('simpleTable');
  });

  it('includes Bookmark, EquationBlock, EquationInline', () => {
    const names = getDefaultInkioExtensions().map((e: any) => e.name);
    expect(names).toContain('bookmark');
    expect(names).toContain('equationBlock');
    expect(names).toContain('equationInline');
  });
});

describe('getDefaultInkioExtensions — adapter path', () => {
  it('auto-enables blockHandle when using adapter', () => {
    const adapter = { file: { uploadFile: async () => 'url' } };
    expect(isExtensionsAdapter(adapter)).toBe(true);

    const names = getDefaultInkioExtensions(adapter).map((e: any) => e.name);
    expect(names).toContain('blockHandle');
  });

  it('includes same core extensions as options path', () => {
    const adapter = { suggestion: {} };
    const names = getDefaultInkioExtensions(adapter).map((e: any) => e.name);
    expect(names).toContain('doc');
    expect(names).toContain('paragraph');
    expect(names).toContain('imageBlock');
    expect(names).toContain('mention');
  });
});
