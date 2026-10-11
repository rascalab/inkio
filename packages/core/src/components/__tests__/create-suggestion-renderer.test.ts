import { createSuggestionRenderer } from '../create-suggestion-renderer';

const hostRender = vi.hoisted(() => vi.fn());
vi.mock('../../utils/overlay-host', () => ({
  createOverlayHost: () => ({
    element: document.createElement('div'),
    render: hostRender,
    destroy: () => {},
  }),
}));

describe('SuggestionPopup', () => {
  it('should export createSuggestionRenderer', () => {
    expect(typeof createSuggestionRenderer).toBe('function');
  });

  it('Escape key should return false to let the plugin handle it', () => {
    const renderer = createSuggestionRenderer({ header: 'Test' });
    const instance = renderer();

    const result = instance.onKeyDown?.({
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    } as any);

    expect(result).toBe(false);
  });

  it('non-Escape key should delegate to component', () => {
    const renderer = createSuggestionRenderer({ header: 'Test' });
    const instance = renderer();

    // component is null, so should return false
    const result = instance.onKeyDown?.({
      event: new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    } as any);

    expect(result).toBe(false);
  });
});

// Tiptap >= 3.31 calls the renderer with `loading: true` and no items before
// each result; those passes must never reach the list as an empty state.
describe('SuggestionPopup loading passes', () => {
  const items = [{ id: 'a', label: 'A' }];
  const renderedItems = () => hostRender.mock.calls.map(([node]) => node.props.items);

  function open() {
    const instance = createSuggestionRenderer({ header: 'Test' })();
    const base = {
      editor: { view: { dom: document.createElement('div') } },
      clientRect: () => null,
      command: () => {},
    };
    const pass = (loading: boolean, list: unknown[]) => ({ ...base, loading, items: list }) as any;
    instance.onStart?.(pass(true, []));
    return { instance, pass };
  }

  afterEach(() => {
    hostRender.mockClear();
  });

  it('shows nothing until the first result arrives', () => {
    const { instance, pass } = open();
    instance.onUpdate?.(pass(true, []));
    expect(hostRender).not.toHaveBeenCalled();

    instance.onUpdate?.(pass(false, items));
    expect(renderedItems()).toEqual([items]);
    instance.onExit?.(pass(false, items));
  });

  it('keeps the previous list while the next query loads', () => {
    const { instance, pass } = open();
    instance.onUpdate?.(pass(false, items));
    instance.onUpdate?.(pass(true, []));
    expect(renderedItems()).toEqual([items, items]);

    instance.onUpdate?.(pass(false, []));
    expect(renderedItems()).toEqual([items, items, []]);
    instance.onExit?.(pass(false, []));
  });

  it('starts hidden again after the popup closes', () => {
    const { instance, pass } = open();
    instance.onUpdate?.(pass(false, items));
    instance.onExit?.(pass(false, items));
    hostRender.mockClear();

    instance.onStart?.(pass(true, []));
    expect(hostRender).not.toHaveBeenCalled();
    instance.onExit?.(pass(true, []));
  });
});
