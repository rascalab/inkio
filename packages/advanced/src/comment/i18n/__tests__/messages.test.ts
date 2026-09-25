import { describe, expect, it } from 'vitest';
import {
  enCommentMessages,
  formatRelativeTime,
  formatTimeAgo,
} from '../messages';

const time = enCommentMessages.commentPanel.time;

describe('formatTimeAgo', () => {
  it('coerces ISO string dates like Date objects (persisted threads)', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(time, fiveMinutesAgo.toISOString())).toBe(
      formatTimeAgo(time, fiveMinutesAgo),
    );
  });

  it('accepts epoch numbers', () => {
    expect(formatTimeAgo(time, Date.now() - 30 * 1000)).toBe(time.justNow);
  });

  it('falls back to justNow for unparseable input instead of throwing', () => {
    expect(() => formatTimeAgo(time, 'not-a-date')).not.toThrow();
    expect(formatTimeAgo(time, 'not-a-date')).toBe(time.justNow);
  });
});

describe('formatRelativeTime', () => {
  it('replaces every placeholder, not just the first', () => {
    expect(formatRelativeTime('{count} of {count}', 3)).toBe('3 of 3');
  });
});
