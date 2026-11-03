import { render, screen } from '@testing-library/react';
import { SuggestionList } from '../SuggestionList';

describe('SuggestionList words', () => {
  it('says its empty state and list name in the locale', () => {
    render(<SuggestionList items={[]} command={() => {}} locale="ko" />);

    expect(screen.getByText('검색 결과 없음')).toBeTruthy();
    expect(screen.getByRole('listbox', { name: '추천 항목' })).toBeTruthy();
  });
});
