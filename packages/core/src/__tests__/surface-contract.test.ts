/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/tokens.css'), 'utf8');
const styleCss = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

describe('surface token contract', () => {
  it('defines the shared surface token ladder', () => {
    [
      '--inkio-surface-shell',
      '--inkio-surface-panel',
      '--inkio-surface-field',
      '--inkio-surface-border',
      '--inkio-surface-border-strong',
      '--inkio-surface-shadow',
      '--inkio-surface-shadow-lg',
      '--inkio-surface-blur-shell',
      '--inkio-surface-blur-panel',
      '--inkio-surface-blur-field',
    ].forEach((token) => {
      expect(tokensCss).toContain(token);
    });
  });

  it('maps core chrome surfaces onto the shared surface tokens', () => {
    [
      'background-color: var(--inkio-surface-shell);',
      'background-color: var(--inkio-surface-panel);',
      'background-color: var(--inkio-surface-field);',
      'border: 1px solid var(--inkio-surface-border);',
      'backdrop-filter: blur(var(--inkio-surface-blur-panel));',
      'box-shadow: var(--inkio-surface-shadow-lg);',
    ].forEach((snippet) => {
      expect(styleCss).toContain(snippet);
    });
  });
});
