import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionList, type SuggestionListRef } from '../SuggestionList';

describe('SuggestionList words', () => {
  it('says its empty state and list name in the locale', () => {
    render(<SuggestionList items={[]} command={() => {}} locale="ko" />);

    expect(screen.getByText('검색 결과 없음')).toBeTruthy();
    expect(screen.getByRole('listbox', { name: '추천 항목' })).toBeTruthy();
  });
});

describe('SuggestionList keyboard selection', () => {
  it('leaves composing keys and empty-list navigation to the editor', () => {
    const ref = createRef<SuggestionListRef>();
    const command = vi.fn();
    const items = [{ id: '1', label: 'First' }, { id: '2', label: 'Second' }];
    const { rerender } = render(<SuggestionList ref={ref} items={items} command={command} />);
    const press = (key: string, init: KeyboardEventInit = {}) =>
      ref.current!.onKeyDown({ event: new KeyboardEvent('keydown', { key, ...init }) });
    expect(press('ArrowDown', { isComposing: true })).toBe(false);
    expect(press('Enter', { keyCode: 229 })).toBe(false);
    expect(command).not.toHaveBeenCalled();
    act(() => { expect(press('ArrowDown')).toBe(true); });
    expect(press('Enter')).toBe(true);
    expect(command).toHaveBeenCalledWith(items[1]);

    rerender(<SuggestionList ref={ref} items={[]} command={command} />);
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter']) expect(press(key)).toBe(false);
  });

  it('keeps mouse selection from taking focus away from the editor', () => {
    const command = vi.fn();
    const item = { id: '1', label: 'First' };
    render(<SuggestionList items={[item]} command={command} />);
    const option = screen.getByRole('option');
    expect(option.tabIndex).toBe(-1);
    expect(fireEvent.mouseDown(option)).toBe(false);
    fireEvent.click(option);
    expect(command).toHaveBeenCalledWith(item);
  });
});
