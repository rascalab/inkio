import { getDefaultCoreExtensions } from '../defaults';

describe('defaults', () => {
  it('getDefaultCoreExtensions should not include image extension by default', () => {
    const extensions = getDefaultCoreExtensions();
    const names = extensions.map((ext: any) => ext.name);
    expect(names).not.toContain('image');
  });

  it('getDefaultCoreExtensions should include placeholder and clear marks extension', () => {
    const extensions = getDefaultCoreExtensions();
    const names = extensions.map((ext: any) => ext.name);
    expect(names).toContain('placeholder');
    expect(names).toContain('clearMarksOnEnter');
  });

  it('getDefaultCoreExtensions should include key document structure extensions', () => {
    const extensions = getDefaultCoreExtensions();
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('doc');
    expect(names).toContain('paragraph');
    expect(names).toContain('text');
    expect(names).toContain('bold');
  });
});
