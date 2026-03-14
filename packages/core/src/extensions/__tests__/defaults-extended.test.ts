import { getExtensions } from '../defaults';

describe('getExtensions — option flags', () => {
  it('returns an array of extensions by default', () => {
    const extensions = getExtensions();
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
  });

  it('includes BulletList and ListItem by default', () => {
    const names = getExtensions().map((e: any) => e.name);
    expect(names).toContain('bulletList');
    expect(names).toContain('listItem');
  });

  it('includes OrderedList and ListItem by default', () => {
    const names = getExtensions().map((e: any) => e.name);
    expect(names).toContain('orderedList');
    expect(names).toContain('listItem');
  });

  it('includes TaskList and TaskItem by default', () => {
    const names = getExtensions().map((e: any) => e.name);
    expect(names).toContain('taskList');
    expect(names).toContain('taskItem');
  });

  it('includes Heading by default', () => {
    const names = getExtensions().map((e: any) => e.name);
    expect(names).toContain('heading');
  });

  it('excludes BulletList when bulletList: false but keeps ListItem because orderedList is still enabled', () => {
    const names = getExtensions({ bulletList: false }).map((e: any) => e.name);
    expect(names).not.toContain('bulletList');
    expect(names).toContain('listItem');
  });

  it('excludes OrderedList when orderedList: false but keeps ListItem because bulletList is still enabled', () => {
    const names = getExtensions({ orderedList: false }).map((e: any) => e.name);
    expect(names).not.toContain('orderedList');
    expect(names).toContain('listItem');
  });

  it('excludes both BulletList and ListItem when bulletList: false and orderedList: false', () => {
    const names = getExtensions({ bulletList: false, orderedList: false }).map((e: any) => e.name);
    expect(names).not.toContain('bulletList');
    expect(names).not.toContain('orderedList');
    expect(names).not.toContain('listItem');
  });

  it('excludes Heading when heading: false', () => {
    const names = getExtensions({ heading: false }).map((e: any) => e.name);
    expect(names).not.toContain('heading');
  });

  it('excludes TaskList and TaskItem when taskList: false', () => {
    const names = getExtensions({ taskList: false }).map((e: any) => e.name);
    expect(names).not.toContain('taskList');
    expect(names).not.toContain('taskItem');
  });

  it('still includes ListMerge when only taskList is disabled but bullet/ordered lists remain', () => {
    const names = getExtensions({ taskList: false }).map((e: any) => e.name);
    expect(names).toContain('listMerge');
  });

  it('excludes ListMerge when all list types are disabled', () => {
    const names = getExtensions({
      bulletList: false,
      orderedList: false,
      taskList: false,
    }).map((e: any) => e.name);
    expect(names).not.toContain('listMerge');
  });

  it('passes placeholder through to Placeholder extension', () => {
    const extensions = getExtensions({ placeholder: 'Type here...' });
    const placeholder = extensions.find((e: any) => e.name === 'placeholder') as any;
    expect(placeholder).toBeDefined();
    // The placeholder option is stored in extension options
    expect(placeholder.options.placeholder).toBe('Type here...');
  });

  it('uses default placeholder text when none specified', () => {
    const extensions = getExtensions();
    const placeholder = extensions.find((e: any) => e.name === 'placeholder') as any;
    expect(placeholder.options.placeholder).toBe('Start typing...');
  });

  it('excludes imageBlock when imageBlock: false', () => {
    const names = getExtensions({ imageBlock: false }).map((e: any) => e.name);
    expect(names).not.toContain('imageBlock');
  });

  it('includes imageBlock by default', () => {
    const names = getExtensions().map((e: any) => e.name);
    expect(names).toContain('imageBlock');
  });

  it('includes advanced text formatting extensions by default', () => {
    const names = getExtensions().map((e: any) => e.name);
    expect(names).toContain('textStyle');
    expect(names).toContain('color');
    expect(names).toContain('textAlign');
    expect(names).toContain('subscript');
    expect(names).toContain('superscript');
  });

  it('disables advanced text formatting when option flags are false', () => {
    const names = getExtensions({
      textColor: false,
      textAlign: false,
      subscript: false,
      superscript: false,
    }).map((e: any) => e.name);

    expect(names).not.toContain('color');
    expect(names).not.toContain('textAlign');
    expect(names).not.toContain('subscript');
    expect(names).not.toContain('superscript');
    expect(names).not.toContain('textAlignJustify');
  });

  it('excludes History when history: false', () => {
    const names = getExtensions({ history: false }).map((e: any) => e.name);
    expect(names).not.toContain('history');
  });

  it('excludes ClearMarksOnEnter when clearMarksOnEnter: false', () => {
    const names = getExtensions({ clearMarksOnEnter: false }).map((e: any) => e.name);
    expect(names).not.toContain('clearMarksOnEnter');
  });

  it('always includes required base nodes', () => {
    const names = getExtensions({
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
