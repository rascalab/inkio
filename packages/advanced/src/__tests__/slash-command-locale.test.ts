import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { SlashCommand, type SlashCommandItem } from '../extensions/SlashCommand';
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
    destroy: () => {},
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
    const items = await options.items!({ query, editor });
    return items as SlashCommandItem[];
  }

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    captured.length = 0;
    hostRender.mockClear();
  });

  it('finds default commands by their Korean words', async () => {
    const editor = createEditor(SlashCommand.configure({ locale: 'ko' }));

    const [divider] = await itemsFor(editor, '구분');
    expect(divider).toMatchObject({ id: 'horizontalRule', label: '구분선', description: '가로줄 넣기' });
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
      messages: { core: { slashCommand: { heading1: { label: '큰 제목' } } } },
    }));

    const [first] = await itemsFor(editor, '');
    expect(first).toMatchObject({ label: '큰 제목', description: '큰 제목' });
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

  it('says the popup header and empty state in the locale', async () => {
    const editor = createEditor(SlashCommand.configure({ locale: 'ko' }));
    const { options } = captured.find((entry) => entry.editor === editor)!;

    options.render!().onStart!({
      editor: { view: { dom: document.createElement('div') } },
      items: [],
      command: () => {},
      clientRect: () => null,
    } as never);

    expect(hostRender.mock.calls[0][0].props).toMatchObject({ header: '명령어', locale: 'ko' });
  });

  it('reaches every popup through getDefaultExtensions', () => {
    const named = getDefaultExtensions({ locale: 'ko', hashtagItems: () => [] });
    for (const name of ['mention', 'hashTag', 'slashCommand', 'wikiLink']) {
      const extension = named.find((one) => one.name === name);
      expect(extension?.options.locale, name).toBe('ko');
    }
  });
});
