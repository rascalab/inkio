import { getDefaultCoreExtensions } from '../defaults';

describe('getDefaultCoreExtensions — option flags', () => {
  it('returns an array of extensions by default', () => {
    const extensions = getDefaultCoreExtensions();
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
  });

  it('includes BulletList and ListItem by default', () => {
    const names = getDefaultCoreExtensions().map((e: any) => e.name);
    expect(names).toContain('bulletList');
    expect(names).toContain('listItem');
  });

  it('includes OrderedList and ListItem by default', () => {
    const names = getDefaultCoreExtensions().map((e: any) => e.name);
    expect(names).toContain('orderedList');
    expect(names).toContain('listItem');
  });

  it('includes TaskList and TaskItem by default', () => {
    const names = getDefaultCoreExtensions().map((e: any) => e.name);
    expect(names).toContain('taskList');
    expect(names).toContain('taskItem');
  });

  it('includes Heading by default', () => {
    const names = getDefaultCoreExtensions().map((e: any) => e.name);
    expect(names).toContain('heading');
  });

  it('excludes BulletList when bulletList: false but keeps ListItem because orderedList is still enabled', () => {
    const names = getDefaultCoreExtensions({ bulletList: false }).map((e: any) => e.name);
    expect(names).not.toContain('bulletList');
    expect(names).toContain('listItem');
  });

  it('excludes OrderedList when orderedList: false but keeps ListItem because bulletList is still enabled', () => {
    const names = getDefaultCoreExtensions({ orderedList: false }).map((e: any) => e.name);
    expect(names).not.toContain('orderedList');
    expect(names).toContain('listItem');
  });

  it('excludes both BulletList and ListItem when bulletList: false and orderedList: false', () => {
    const names = getDefaultCoreExtensions({ bulletList: false, orderedList: false }).map((e: any) => e.name);
    expect(names).not.toContain('bulletList');
    expect(names).not.toContain('orderedList');
    expect(names).not.toContain('listItem');
  });

  it('excludes Heading when heading: false', () => {
    const names = getDefaultCoreExtensions({ heading: false }).map((e: any) => e.name);
    expect(names).not.toContain('heading');
  });

  it('excludes TaskList and TaskItem when taskList: false', () => {
    const names = getDefaultCoreExtensions({ taskList: false }).map((e: any) => e.name);
    expect(names).not.toContain('taskList');
    expect(names).not.toContain('taskItem');
  });

  it('still includes ListMerge when only taskList is disabled but bullet/ordered lists remain', () => {
    const names = getDefaultCoreExtensions({ taskList: false }).map((e: any) => e.name);
    expect(names).toContain('listMerge');
  });

  it('excludes ListMerge when all list types are disabled', () => {
    const names = getDefaultCoreExtensions({
      bulletList: false,
      orderedList: false,
      taskList: false,
    }).map((e: any) => e.name);
    expect(names).not.toContain('listMerge');
  });

  it('passes placeholder through to Placeholder extension', () => {
    const extensions = getDefaultCoreExtensions({ placeholder: 'Type here...' });
    const placeholder = extensions.find((e: any) => e.name === 'placeholder') as any;
    expect(placeholder).toBeDefined();
    // The placeholder option is stored in extension options
    expect(placeholder.options.placeholder).toBe('Type here...');
  });

  it('uses default placeholder text when none specified', () => {
    const extensions = getDefaultCoreExtensions();
    const placeholder = extensions.find((e: any) => e.name === 'placeholder') as any;
    expect(placeholder.options.placeholder).toBe('Start typing...');
  });

  it('excludes imageBlock when imageBlock: false', () => {
    const names = getDefaultCoreExtensions({ imageBlock: false }).map((e: any) => e.name);
    expect(names).not.toContain('imageBlock');
  });

  it('includes imageBlock by default', () => {
    const names = getDefaultCoreExtensions().map((e: any) => e.name);
    expect(names).toContain('imageBlock');
  });

  it('excludes History when history: false', () => {
    const names = getDefaultCoreExtensions({ history: false }).map((e: any) => e.name);
    expect(names).not.toContain('history');
  });

  it('excludes ClearMarksOnEnter when clearMarksOnEnter: false', () => {
    const names = getDefaultCoreExtensions({ clearMarksOnEnter: false }).map((e: any) => e.name);
    expect(names).not.toContain('clearMarksOnEnter');
  });

  it('always includes required base nodes', () => {
    const names = getDefaultCoreExtensions({
      bold: false,
      italic: false,
      heading: false,
      bulletList: false,
      orderedList: false,
      taskList: false,
      history: false,
    }).map((e: any) => e.name);
    expect(names).toContain('doc');
    expect(names).toContain('paragraph');
    expect(names).toContain('text');
    expect(names).toContain('hardBreak');
  });
});
