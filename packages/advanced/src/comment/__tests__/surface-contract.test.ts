/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const commentCss = readFileSync(resolve(process.cwd(), 'src/comment/style.css'), 'utf8');

describe('comment surface contract', () => {
  it('uses the shared shell, panel, and field tokens for comment chrome', () => {
    [
      'background: var(--inkio-surface-shell);',
      'background: var(--inkio-surface-panel);',
      'background-color: var(--inkio-surface-field);',
      'border: 1px solid var(--inkio-surface-border);',
      'box-shadow: var(--inkio-surface-shadow-lg);',
      'backdrop-filter: blur(var(--inkio-surface-blur-panel));',
    ].forEach((snippet) => {
      expect(commentCss).toContain(snippet);
    });
  });

  it('uses subtle surface variants for quote blocks and destructive/resolve actions', () => {
    [
      '--inkio-comment-quote-surface:',
      '--inkio-comment-action-resolve-bg:',
      '--inkio-comment-action-delete-bg:',
      'background: var(--inkio-comment-quote-surface);',
      'background: var(--inkio-comment-action-resolve-bg);',
      'background: var(--inkio-comment-action-delete-bg);',
    ].forEach((snippet) => {
      expect(commentCss).toContain(snippet);
    });
  });

  it('uses focus-visible rings instead of generic focus selectors for reply fields', () => {
    expect(commentCss).toContain('.inkio-comment-reply-input:focus-visible');
    expect(commentCss).toContain('.inkio-thread-popover-reply-input:focus-visible');
  });
});
