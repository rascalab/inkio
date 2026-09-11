import { describe, expect, it } from 'vitest';
import { getPreferredTextAnnotationWidth } from '../text-metrics';

// jsdom has no canvas measure context, so these exercise the fallback
// estimator (estimateLineWidth) used when measureText is unavailable.
describe('text-metrics CJK width estimation', () => {
  const base = { fontSize: 16, fontStyle: 'normal' as const, fontFamily: 'system-ui' };

  it('estimates CJK glyphs near 1em instead of the Latin 0.62em factor', () => {
    const latin = getPreferredTextAnnotationWidth({ ...base, text: 'abcdefgh' });
    const korean = getPreferredTextAnnotationWidth({ ...base, text: '가나다라마바사아' });

    // 8 CJK glyphs at 16px ≈ 128px wide; 8 Latin glyphs ≈ 80px.
    expect(korean).toBeGreaterThan(latin);
  });

  it('mixes Latin and CJK widths per character', () => {
    const mixed = getPreferredTextAnnotationWidth({ ...base, text: 'abcd가나다라' });
    const latinOnly = getPreferredTextAnnotationWidth({ ...base, text: 'abcd1234' });
    expect(mixed).toBeGreaterThan(latinOnly);
  });
});
