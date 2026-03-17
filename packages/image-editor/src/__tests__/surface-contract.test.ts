/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const imageEditorCss = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

describe('image editor surface contract', () => {
  it('aliases private glass tokens to the shared surface tokens', () => {
    [
      '--inkio-ie-glass-shell: var(--inkio-surface-shell);',
      '--inkio-ie-glass-panel: var(--inkio-surface-panel);',
      '--inkio-ie-glass-field: var(--inkio-surface-field);',
      '--inkio-ie-glass-border: var(--inkio-surface-border);',
    ].forEach((snippet) => {
      expect(imageEditorCss).toContain(snippet);
    });
  });

  it('uses shared surface shadows and blur values on overlay chrome', () => {
    [
      'box-shadow: var(--inkio-surface-shadow-lg);',
      'backdrop-filter: blur(var(--inkio-surface-blur-shell));',
      'backdrop-filter: blur(var(--inkio-surface-blur-panel));',
      'backdrop-filter: blur(var(--inkio-surface-blur-field));',
    ].forEach((snippet) => {
      expect(imageEditorCss).toContain(snippet);
    });
  });
});
