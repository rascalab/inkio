import { Mention } from '../extensions/Mention';

describe('Mention suggestion items debounce + stale-drop', () => {
  function createSuggestionHarness(itemsImpl: (props: { query: string }) => unknown[] | Promise<unknown[]>) {
    const options = Mention.config.addOptions?.call({ name: 'mention' } as any);
    const items = vi.fn(itemsImpl);
    (options as any).items = items;
    const editor = {
      extensionManager: { extensions: [{ name: 'mention', options }] },
    } as any;
    const suggest = (query: string) => (options as any).suggestion.items({ query, editor });
    return { options, items, suggest };
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

  it('drops a slow earlier response that resolves after a newer query', async () => {
    let resolveSlow!: (value: unknown[]) => void;
    const slow = new Promise<unknown[]>((resolve) => {
      resolveSlow = resolve;
    });
    const { suggest } = createSuggestionHarness(({ query }) =>
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
});
