import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { PluginKey } from '@tiptap/pm/state';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { HashTag, HashTagPluginKey } from '../extensions/HashTag';
import { Mention, MentionPluginKey } from '../extensions/Mention';

// Capture the options each real editor hands to the Suggestion plugin so the
// wired-up items()/command/allow are exercised exactly as the editor sees them.
const captured = vi.hoisted(() => [] as Array<{ editor: unknown; options: SuggestionOptions<any, any> }>);
vi.mock('@tiptap/suggestion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/suggestion')>();
  const Suggestion = (options: SuggestionOptions<any, any>) => {
    captured.push({ editor: options.editor, options });
    return actual.Suggestion(options);
  };
  return { ...actual, Suggestion, default: Suggestion };
});

type Items = (props: { query: string }) => unknown[] | Promise<unknown[]>;

const cases = [
  { label: 'Mention', ext: Mention, name: 'mention', char: '@', pluginKey: MentionPluginKey },
  { label: 'HashTag', ext: HashTag, name: 'hashTag', char: '#', pluginKey: HashTagPluginKey },
] as const;

describe.each(cases)('$label suggestion items debounce + stale-drop', ({ ext, name, char, pluginKey }) => {
  const editors: Editor[] = [];

  function createEditor(configured: ReturnType<typeof ext.configure>) {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, configured],
      content: '<p></p>',
    });
    editors.push(editor);
    return editor;
  }

  function suggestionFor(editor: Editor, key: PluginKey = pluginKey) {
    const entry = captured.find((c) => c.editor === editor && c.options.pluginKey === key);
    expect(entry).toBeDefined();
    const options = entry!.options;
    return {
      options,
      suggest: (query: string) => options.items!({ query, editor }) as Promise<unknown[]>,
    };
  }

  function createHarness(itemsImpl: Items, extra: Record<string, unknown> = {}) {
    const items = vi.fn(itemsImpl);
    const configured = ext.configure({ items: items as never, ...extra });
    const editor = createEditor(configured);
    return { items, configured, editor, ...suggestionFor(editor) };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    editors.splice(0).forEach((editor) => editor.destroy());
    captured.length = 0;
  });

  it('uses the trigger char and plugin key', () => {
    const { options } = createHarness(() => []);
    expect(options.char).toBe(char);
    expect(options.pluginKey).toBe(pluginKey);
  });

  it('coalesces rapid keystrokes into a single items() call with the latest query', async () => {
    const { items, suggest } = createHarness(({ query }) => [{ id: query, label: query }]);

    const first = suggest('a');
    const second = suggest('ab');
    const flushed = Promise.all([first, second]);
    await vi.advanceTimersByTimeAsync(500);
    const [r1, r2] = await flushed;

    expect(items).toHaveBeenCalledTimes(1);
    expect(items).toHaveBeenCalledWith({ query: 'ab' });
    expect(r1).toEqual([]);
    expect(r2).toEqual([{ id: 'ab', label: 'ab' }]);
  });

  it('drops a slow earlier response that resolves after a newer query', async () => {
    let resolveSlow!: (value: unknown[]) => void;
    const slow = new Promise<unknown[]>((resolve) => {
      resolveSlow = resolve;
    });
    const { suggest } = createHarness(({ query }) =>
      query === 'a' ? slow : Promise.resolve([{ id: 'ab', label: 'ab' }]),
    );

    const first = suggest('a');
    await vi.advanceTimersByTimeAsync(200);
    const second = suggest('ab');
    const flushed = Promise.all([first, second]);
    await vi.advanceTimersByTimeAsync(200);
    resolveSlow([{ id: 'a', label: 'a' }]);
    const [r1, r2] = await flushed;

    expect(r1).toEqual([]);
    expect(r2).toEqual([{ id: 'ab', label: 'ab' }]);
  });

  it('routes items() errors to onError with the extension source', async () => {
    const onError = vi.fn();
    const { suggest } = createHarness(() => Promise.reject(new Error('boom')), { onError });

    const result = suggest('x');
    await vi.advanceTimersByTimeAsync(200);

    expect(await result).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][1]).toEqual({ source: `${name}.suggestion`, recoverable: true });
  });

  it('keeps per-editor sequences independent for one configured extension', async () => {
    const items = vi.fn(({ query }: { query: string }) => [{ id: query, label: query }]);
    const configured = ext.configure({ items: items as never });
    const editorA = createEditor(configured);
    const editorB = createEditor(configured);

    const fromA = suggestionFor(editorA).suggest('a');
    const fromB = suggestionFor(editorB).suggest('b');
    await vi.advanceTimersByTimeAsync(500);
    const [rA, rB] = await Promise.all([fromA, fromB]);

    expect(rA).toEqual([{ id: 'a', label: 'a' }]);
    expect(rB).toEqual([{ id: 'b', label: 'b' }]);
  });

  it('lets user suggestion overrides win over the defaults', () => {
    const custom = vi.fn(() => []);
    const configured = ext.configure({ suggestion: { items: custom } });
    const editor = createEditor(configured);
    const { options } = suggestionFor(editor);

    expect(options.items).toBe(custom);
    expect(options.char).toBe(char);
  });

  it('allow() only permits the trigger where the node is valid', () => {
    const { options, editor } = createHarness(() => []);
    expect(options.allow!({ editor, state: editor.state, range: { from: 1, to: 1 }, isActive: true })).toBe(true);
  });

  it('suggestion command inserts the node and never touches window selection', () => {
    const { options, editor } = createHarness(() => []);
    expect(options.command!.toString()).not.toContain('collapseToEnd');
    editor.commands.setContent('<p>x y</p>');
    // Replace "x" (1..2) with node + ' '. The following space sits mid text
    // node (textOffset !== 0), so it is intentionally not consumed.
    options.command!({ editor, range: { from: 1, to: 2 }, props: { id: 'i', label: 'L' } });
    expect(editor.getJSON().content?.[0].content).toEqual([
      { type: name, attrs: { id: 'i', label: 'L', mentionSuggestionChar: char } },
      { type: 'text', text: '  y' },
    ]);
  });

  it('suggestion command ignores items without id/label', () => {
    const { options, editor } = createHarness(() => []);
    editor.commands.setContent('<p>x</p>');
    options.command!({ editor, range: { from: 1, to: 2 }, props: { id: 'i' } });
    expect(editor.getText()).toBe('x');
  });
});
