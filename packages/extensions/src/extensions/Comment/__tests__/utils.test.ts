import { getInitials } from '../utils';

describe('getInitials', () => {
  it('returns first letters of each name part uppercased', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('handles single name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('handles empty string', () => {
    expect(getInitials('')).toBe('');
  });

  it('limits to 2 characters', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  it('uppercases the result', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('handles extra whitespace between names', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD');
  });

  it('handles single character name', () => {
    expect(getInitials('J')).toBe('J');
  });

  it('handles names with multiple spaces', () => {
    // filter(Boolean) removes empty strings from split
    expect(getInitials('Anna   Maria')).toBe('AM');
  });
});
