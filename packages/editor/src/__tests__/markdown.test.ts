import { describe, expect, it } from 'vitest';
import * as coreMarkdown from '@inkio/core/markdown';
import * as editorMarkdown from '../markdown';

describe('@inkio/editor/markdown', () => {
  it('re-exports the core markdown helpers', () => {
    expect(editorMarkdown.parseMarkdown).toBe(coreMarkdown.parseMarkdown);
    expect(editorMarkdown.stringifyMarkdown).toBe(coreMarkdown.stringifyMarkdown);
    expect(editorMarkdown.createMarkdownAdapter).toBe(coreMarkdown.createMarkdownAdapter);
  });
});
