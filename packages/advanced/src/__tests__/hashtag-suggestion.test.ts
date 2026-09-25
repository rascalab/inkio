import { HashTag } from '../extensions/HashTag';

describe('HashTag suggestion items debounce + stale-drop', () => {
  function createSuggestionHarness(itemsImpl: (props: { query: string }) => unknown[] | Promise<unknown[]>) {
    const options = HashTag.config.addOptions?.call({ name: 'hashTag' } as never);
    const items = vi.fn(itemsImpl);
    (options as { items: unknown }).items = items;
    const makeEditor = () => ({
      extensionManager: { extensions: [{ name: 'hashTag', options }] },
    });
    const defaultEditor = makeEditor();
    const suggest = (query: string, editor?: { extensionManager: unknown }) =>
      (options as { suggestion: { items: (props: { query: string; editor: unknown }) => Promise<unknown[]> } }).suggestion.items({
        query,
        editor: editor ?? defaultEditor,
      });
    return { options, items, suggest, makeEditor };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid keystrokes into a single items() call with the latest query', async () => {
    const { items, suggest } = createSuggestionHarness(({ query }) => [{ id: query, label: query }]);

    const first = suggest('a');
    const second = suggest('ab');
    const flushed = Promise.all([first, second]).then(([r1, r2]) => ({ r1, r2 }));
    await vi.advanceTimersByTimeAsync(500);
    const { r1, r2 } = await flushed;

    expect(items).toHaveBeenCalledTimes(1);
    expect(items).toHaveBeenCalledWith({ query: 'ab' });
    expect(r1).toEqual([]);
    expect(r2).toEqual([{ id: 'ab', label: 'ab' }]);
  });

  it('keeps per-editor sequences independent', async () => {
    const { suggest, makeEditor } = createSuggestionHarness(({ query }) => [{ id: query, label: query }]);
    const editorA = makeEditor();
    const editorB = makeEditor();

    const fromA = suggest('a', editorA);
    const fromB = suggest('b', editorB);
    await vi.advanceTimersByTimeAsync(500);
    const [rA, rB] = await Promise.all([fromA, fromB]);

    expect(rA).toEqual([{ id: 'a', label: 'a' }]);
    expect(rB).toEqual([{ id: 'b', label: 'b' }]);
  });
});
