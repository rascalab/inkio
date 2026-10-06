/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Relative to this file, not the cwd: the root vitest run starts in the repo root.
const imageEditorCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../style.css'),
  'utf8',
);

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
