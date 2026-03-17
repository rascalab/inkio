import { getExtensions } from '../get-extensions';

describe('defaults', () => {
  it('getExtensions should not include image extension by default', () => {
    const extensions = getExtensions();
    const names = extensions.map((ext: any) => ext.name);
    expect(names).not.toContain('image');
  });

  it('getExtensions should include placeholder and clear marks extension', () => {
    const extensions = getExtensions();
    const names = extensions.map((ext: any) => ext.name);
    expect(names).toContain('placeholder');
    expect(names).toContain('clearMarksOnEnter');
  });

  it('getExtensions should include key document structure extensions', () => {
    const extensions = getExtensions();
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('doc');
    expect(names).toContain('paragraph');
    expect(names).toContain('text');
    expect(names).toContain('bold');
  });
});
