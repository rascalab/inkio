import { createSuggestionRenderer } from '../create-suggestion-renderer';

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
