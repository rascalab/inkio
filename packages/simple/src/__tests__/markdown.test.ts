import { describe, expect, it } from 'vitest';
import * as coreMarkdown from '@inkio/core/markdown';
import * as simpleMarkdown from '../markdown';

describe('@inkio/simple/markdown', () => {
  it('re-exports the core markdown helpers', () => {
    expect(simpleMarkdown.parseMarkdown).toBe(coreMarkdown.parseMarkdown);
    expect(simpleMarkdown.stringifyMarkdown).toBe(coreMarkdown.stringifyMarkdown);
    expect(simpleMarkdown.createMarkdownAdapter).toBe(coreMarkdown.createMarkdownAdapter);
  });
});
