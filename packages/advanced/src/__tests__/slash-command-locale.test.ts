import { setEditorUi } from '@inkio/core';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { SlashCommand, SlashCommandPluginKey, type SlashCommandItem } from '../extensions/SlashCommand';
import { getDefaultExtensions } from '../get-default-extensions';

const captured = vi.hoisted(() => [] as Array<{ editor: unknown; options: SuggestionOptions<any, any> }>);
vi.mock('@tiptap/suggestion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/suggestion')>();
  const Suggestion = (options: SuggestionOptions<any, any>) => {
    captured.push({ editor: options.editor, options });
    return actual.Suggestion(options);
  };
  return { ...actual, Suggestion, default: Suggestion };
});

const hostRender = vi.hoisted(() => vi.fn());
vi.mock('../../../core/src/utils/overlay-host', () => ({
  createOverlayHost: () => ({
    element: document.createElement('div'),
    render: hostRender,
    destroy() { this.element.remove(); },
  }),
}));

describe('slash menu in the editor locale', () => {
  const editors: Editor[] = [];

  function createEditor(configured: ReturnType<typeof SlashCommand.configure>) {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, configured],
      content: '<p></p>',
    });
    editors.push(editor);
    return editor;
  }

  async function itemsFor(editor: Editor, query: string) {
    const { options } = captured.find((entry) => entry.editor === editor)!;
    const items = await options.items!({ query, editor, signal: new AbortController().signal });
    return items as SlashCommandItem[];
  }

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.useRealTimers();
    captured.length = 0;
    hostRender.mockClear();
  });

  it('finds default commands by their Korean words', async () => {
    const editor = createEditor(SlashCommand.configure({ locale: 'ko' }));

    const [divider] = await itemsFor(editor, '구분');
    expect(divider).toMatchObject({ id: 'horizontalRule', label: '구분선' });
  });

  it('still finds them by their id alias', async () => {
    const editor = createEditor(SlashCommand.configure({ locale: 'ko' }));

    expect((await itemsFor(editor, 'heading')).map((item) => item.label)).toEqual(['제목 1', '제목 2', '제목 3']);
  });

  it('stays in English without a locale', async () => {
    const editor = createEditor(SlashCommand);

    const [first] = await itemsFor(editor, '');
    expect(first).toMatchObject({ id: 'heading1', label: 'Heading 1' });
  });

  it('applies message overrides to the default commands', async () => {
    const editor = createEditor(SlashCommand.configure({
      locale: 'ko',
      messages: { core: { slashCommand: { heading1: '큰 제목' } } },
    }));

    const [first] = await itemsFor(editor, '');
    expect(first).toMatchObject({ label: '큰 제목' });
  });

  it('hands transformItems the whole list, so a renamed item can match the query', async () => {
    const transformItems = vi.fn((defaults: SlashCommandItem[]) =>
      defaults.map((item) => (item.id === 'heading1' ? { ...item, label: 'Grid' } : item)),
    );
    const editor = createEditor(SlashCommand.configure({ transformItems }));

    const items = await itemsFor(editor, 'grid');

    expect(transformItems.mock.calls[0][0].length).toBeGreaterThan(1);
    expect(items.map((item) => item.id)).toEqual(['heading1']);
  });

  it('dismisses on an outside pointer without changing the slash text', () => {
    const editor = createEditor(SlashCommand);
    editor.commands.insertContent('/');
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
    expect(editor.getText()).toBe('/');
  });

  it('dismisses the configured plugin when Tab takes focus outside, even before items resolve', () => {
    vi.useFakeTimers();
    const editor = createEditor(SlashCommand.configure({ items: () => [] }));
    const parent = document.body.appendChild(editor.view.dom.parentElement!);
    const outside = document.body.appendChild(document.createElement('button'));
    try {
      editor.view.dom.focus();
      editor.commands.insertContent('/');
      editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      outside.focus();
      vi.advanceTimersToNextFrame();
      expect(outside).toHaveFocus();
      expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
    } finally {
      outside.remove();
      parent.remove();
    }
  });

  it('does not let a superseded response dismiss a matching multiword query', async () => {
    vi.useFakeTimers();
    const slow = Promise.withResolvers<SlashCommandItem[]>();
    const heading = { id: 'heading1', label: 'Heading 1', command: () => {} };
    const editor = createEditor(SlashCommand.configure({ items: ({ query }) => query ? [heading] : slow.promise }));
    editor.commands.insertContent('/');
    editor.commands.insertContent('heading');
    await vi.advanceTimersByTimeAsync(0);
    expect(hostRender.mock.lastCall?.[0].props.items).toEqual([heading]);
    slow.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
    editor.commands.insertContent(' ');
    expect(SlashCommandPluginKey.getState(editor.state)).toMatchObject({ active: true, query: 'heading ' });
  });

  it('accepts a pasted multiword query but not a second slash mid-paragraph', () => {
    const editor = createEditor(SlashCommand);
    editor.commands.insertContent('/Heading 1');
    expect(SlashCommandPluginKey.getState(editor.state)).toMatchObject({ active: true, query: 'Heading 1' });
    editor.commands.insertContent(' /another');
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
  });

  it('stops suggesting after an unmatched query followed by a space', async () => {
    const editor = createEditor(SlashCommand);
    editor.commands.insertContent('/zzz');
    await vi.waitFor(() => expect(hostRender.mock.lastCall?.[0].props.items).toEqual([]));
    editor.commands.insertContent(' ');
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
    editor.commands.insertContent('word');
    expect(SlashCommandPluginKey.getState(editor.state).active).toBe(false);
  });

  it('has no header and says its empty state in the locale', async () => {
    const editor = createEditor(SlashCommand.configure({ locale: 'ko' }));
    const { options } = captured.find((entry) => entry.editor === editor)!;

    options.render!().onStart!({
      editor: { view: { dom: document.createElement('div') } },
      items: [],
      command: () => {},
      clientRect: () => null,
      mount: () => () => {},
    } as never);

    const { props } = hostRender.mock.calls[0][0];
    expect(props.header).toBeUndefined();
    expect(props.locale).toBe('ko');
  });

  it('follows the locale of a live editor', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: getDefaultExtensions({ locale: 'ko' }),
      content: '<p></p>',
    });
    editors.push(editor);
    const [korean] = await itemsFor(editor, '구분');
    expect(korean).toMatchObject({ id: 'horizontalRule', label: '구분선' });

    setEditorUi(editor, { locale: 'en' });

    const [english] = await itemsFor(editor, 'divider');
    expect(english.id).toBe('horizontalRule');
    expect(english.label).not.toBe('구분선');
    expect(await itemsFor(editor, '구분')).toHaveLength(0);
  });
});
