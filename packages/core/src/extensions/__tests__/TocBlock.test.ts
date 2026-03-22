import { describe, expect, it } from 'vitest';
import { getExtensions } from '../get-extensions';

describe('TocBlock', () => {
  it('is included in default extensions', () => {
    const extensions = getExtensions({});
    expect(extensions.some((ext) => ext.name === 'tocBlock')).toBe(true);
  });

  it('can be disabled', () => {
    const extensions = getExtensions({ tocBlock: false });
    expect(extensions.some((ext) => ext.name === 'tocBlock')).toBe(false);
  });
});
