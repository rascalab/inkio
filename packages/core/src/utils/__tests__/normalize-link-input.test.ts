import { describe, expect, it } from 'vitest';
import { normalizeLinkInput } from '../url-safety';

describe('normalizeLinkInput', () => {
  it.each([
    ['example.com', 'https://example.com'],
    [' docs.example.co.kr/a?b=1 ', 'https://docs.example.co.kr/a?b=1'],
    ['example.com:8080/a', 'https://example.com:8080/a'],
    ['me@example.com', 'mailto:me@example.com'],
    ['https://example.com', 'https://example.com'],
    ['mailto:me@example.com', 'mailto:me@example.com'],
    ['/docs', '/docs'],
    ['#section', '#section'],
    ['./a.png', './a.png'],
    ['그냥 글자', '그냥 글자'],
    ['v1.2', 'v1.2'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLinkInput(input)).toBe(expected);
  });
});
