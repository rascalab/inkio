import { DetailsShortcut } from '../DetailsShortcut';

describe('DetailsShortcut', () => {
  it('converts "> " into a details command when available', () => {
    const rules = DetailsShortcut.config.addInputRules?.call({} as never) ?? [];
    expect(rules).toHaveLength(1);

    const chain = {
      deleteRange: vi.fn(() => chain),
      setDetails: vi.fn(() => chain),
      run: vi.fn(() => true),
    } as Record<string, any>;

    (rules[0] as any).handler({
      range: { from: 2, to: 4 },
      chain: () => chain,
    });

    expect(chain.deleteRange).toHaveBeenCalledWith({ from: 2, to: 4 });
    expect(chain.setDetails).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('is a safe no-op when details commands are unavailable', () => {
    const rules = DetailsShortcut.config.addInputRules?.call({} as never) ?? [];
    const chain = {
      deleteRange: vi.fn(() => chain),
      run: vi.fn(() => true),
    } as Record<string, any>;

    expect(() => {
      (rules[0] as any).handler({
        range: { from: 2, to: 4 },
        chain: () => chain,
      });
    }).not.toThrow();

    expect(chain.deleteRange).toHaveBeenCalledWith({ from: 2, to: 4 });
    expect(chain.run).not.toHaveBeenCalled();
  });
});
