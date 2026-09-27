import { createLatestWinsItems, type LatestWinsCell } from '../latest-wins';

describe('createLatestWinsItems', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops a stale response that resolves after a newer request', async () => {
    const gates: Array<(value: string[]) => void> = [];
    const resolve = createLatestWinsItems<{ query: string }, string>({
      source: () => new Promise<string[]>((r) => gates.push(r)),
    });

    const first = resolve({ query: 'a' });
    const second = resolve({ query: 'ab' });
    gates[1](['ab']);
    gates[0](['a']);

    expect(await first).toEqual([]);
    expect(await second).toEqual(['ab']);
  });

  it('invokes source synchronously when there is no debounce', () => {
    const source = vi.fn(() => ['x']);
    const resolve = createLatestWinsItems({ source });
    void resolve({});
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('trailing-debounces: only the last request within the window reaches source', async () => {
    vi.useFakeTimers();
    const source = vi.fn(({ query }: { query: string }) => [query]);
    const resolve = createLatestWinsItems({ source, debounceMs: 150 });

    const r1 = resolve({ query: 'a' });
    await vi.advanceTimersByTimeAsync(100);
    const r2 = resolve({ query: 'ab' });
    await vi.advanceTimersByTimeAsync(100);
    expect(source).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);

    expect(await r1).toEqual([]);
    expect(await r2).toEqual(['ab']);
    expect(source).toHaveBeenCalledTimes(1);
    expect(source).toHaveBeenCalledWith({ query: 'ab' }, expect.anything());
  });

  it('routes errors of the current request to onError (normalized) and yields []', async () => {
    const onError = vi.fn();
    const resolve = createLatestWinsItems({
      source: () => Promise.reject('boom'),
      onError,
    });
    const args = { query: 'q' };

    expect(await resolve(args)).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('boom');
    expect(onError.mock.calls[0][1]).toBe(args);
  });

  it('swallows errors from superseded requests', async () => {
    const onError = vi.fn();
    let rejectFirst!: (error: Error) => void;
    let call = 0;
    const resolve = createLatestWinsItems<object, string>({
      source: () => (call++ === 0
        ? new Promise<string[]>((_, reject) => { rejectFirst = reject; })
        : ['fresh']),
      onError,
    });

    const first = resolve({});
    const second = resolve({});
    rejectFirst(new Error('late'));

    expect(await first).toEqual([]);
    expect(await second).toEqual(['fresh']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('treats a nullish source result as []', async () => {
    const resolve = createLatestWinsItems({ source: () => undefined });
    expect(await resolve({})).toEqual([]);
  });

  it('exposes isCurrent so multi-step sources can bail between awaits', async () => {
    const seen: boolean[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let call = 0;
    const resolve = createLatestWinsItems<object, string>({
      source: async (_args, { isCurrent }) => {
        if (call++ === 0) await gate;
        seen.push(isCurrent());
        return ['x'];
      },
    });

    const first = resolve({});
    const second = resolve({});
    release();
    await Promise.all([first, second]);

    expect(seen).toEqual([true, false]);
  });

  it('isolates scopes (e.g. per editor) so they never cancel each other', async () => {
    vi.useFakeTimers();
    const cells = new WeakMap<object, LatestWinsCell>();
    const cellFor = (editor: object) => {
      let cell = cells.get(editor);
      if (!cell) cells.set(editor, (cell = { value: 0 }));
      return cell;
    };
    const resolve = createLatestWinsItems<{ editor: object; query: string }, string>({
      source: ({ query }) => [query],
      debounceMs: 150,
      scope: ({ editor }) => cellFor(editor),
    });
    const editorA = {};
    const editorB = {};

    const fromA = resolve({ editor: editorA, query: 'a' });
    const fromB = resolve({ editor: editorB, query: 'b' });
    await vi.advanceTimersByTimeAsync(200);

    expect(await fromA).toEqual(['a']);
    expect(await fromB).toEqual(['b']);
  });

  it('separate resolvers own separate default scopes', async () => {
    const gates: Array<(value: string[]) => void> = [];
    const make = () => createLatestWinsItems<object, string>({
      source: () => new Promise<string[]>((r) => gates.push(r)),
    });
    const a = make();
    const b = make();

    const fromA = a({});
    const fromB = b({});
    gates[0](['a']);
    gates[1](['b']);

    expect(await fromA).toEqual(['a']);
    expect(await fromB).toEqual(['b']);
  });

  it('shares an external cell across resolvers when scoped to it', async () => {
    const latest: LatestWinsCell = { value: 0 };
    const gates: Array<(value: string[]) => void> = [];
    const make = () => createLatestWinsItems<object, string>({
      source: () => new Promise<string[]>((r) => gates.push(r)),
      scope: () => latest,
    });

    const first = make()({});
    const second = make()({});
    gates[0](['stale']);
    gates[1](['fresh']);

    expect(await first).toEqual([]);
    expect(await second).toEqual(['fresh']);
    expect(latest.value).toBe(2);
  });
});
