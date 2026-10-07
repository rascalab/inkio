import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { WikiLink, WikiLinkPluginKey, type WikiLinkItem } from '../extensions/WikiLink';

const captured = vi.hoisted(() => [] as Array<{ editor: unknown; options: SuggestionOptions<any, any> }>);
vi.mock('@tiptap/suggestion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/suggestion')>();
  const Suggestion = (options: SuggestionOptions<any, any>) => {
    captured.push({ editor: options.editor, options });
    return actual.Suggestion(options);
  };
  return { ...actual, Suggestion, default: Suggestion };
});

type SuggestionState = { active: boolean; query: string | null; range: { from: number; to: number } };

describe('WikiLink [[ suggestion', () => {
  const editors: Editor[] = [];

  function createEditor(configured: ReturnType<typeof WikiLink.configure>) {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, configured],
      content: '<p></p>',
    });
    editors.push(editor);
    return editor;
  }

  function suggestionFor(editor: Editor) {
    const entry = captured.find((c) => c.editor === editor);
    expect(entry).toBeDefined();
    return entry!.options as SuggestionOptions<WikiLinkItem, WikiLinkItem>;
  }

  function wikiLinkHrefs(editor: Editor) {
    const hrefs: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'wikiLink') hrefs.push(node.attrs.href);
    });
    return hrefs;
  }

  afterEach(() => {
    vi.useRealTimers();
    editors.splice(0).forEach((editor) => editor.destroy());
    captured.length = 0;
  });

  it('adds no popup without items, leaving the ]] input rule as the only path', () => {
    const editor = createEditor(WikiLink);
    expect(captured).toHaveLength(0);
    expect(WikiLinkPluginKey.getState(editor.state)).toBeUndefined();
  });

  it('opens on [[ and passes a query that may contain spaces', () => {
    const editor = createEditor(WikiLink.configure({ items: () => [] }));
    expect(suggestionFor(editor).char).toBe('[[');

    editor.commands.insertContent('see [[Getting Sta');

    const state = WikiLinkPluginKey.getState(editor.state) as SuggestionState;
    expect(state.active).toBe(true);
    expect(state.query).toBe('Getting Sta');
  });

  it('replaces [[query with a wiki link to the chosen item id', () => {
    const editor = createEditor(WikiLink.configure({ items: () => [] }));
    editor.commands.insertContent('see [[Getting Sta');
    const { range } = WikiLinkPluginKey.getState(editor.state) as SuggestionState;

    suggestionFor(editor).command!({
      editor,
      range,
      props: { id: 'Getting Started', label: 'Getting Started' },
    });

    expect(wikiLinkHrefs(editor)).toEqual(['Getting Started']);
    expect(editor.getText()).not.toContain('[[');
  });

  it('refuses unsafe targets from items', () => {
    const editor = createEditor(WikiLink.configure({ items: () => [] }));
    editor.commands.insertContent('[[x');
    const { range } = WikiLinkPluginKey.getState(editor.state) as SuggestionState;

    suggestionFor(editor).command!({
      editor,
      range,
      props: { id: 'javascript:alert(1)', label: 'evil' },
    });

    expect(wikiLinkHrefs(editor)).toEqual([]);
  });

  it('queries items with the typed text and routes failures to onError', async () => {
    vi.useFakeTimers();
    const items = vi.fn(() => Promise.reject(new Error('boom')));
    const onError = vi.fn();
    const editor = createEditor(WikiLink.configure({ items, onError }));

    const result = suggestionFor(editor).items!({ query: 'Get', editor });
    await vi.advanceTimersByTimeAsync(200);

    expect(await result).toEqual([]);
    expect(items).toHaveBeenCalledWith({ query: 'Get' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toEqual({ source: 'wikiLink.suggestion', recoverable: true });
  });
});
