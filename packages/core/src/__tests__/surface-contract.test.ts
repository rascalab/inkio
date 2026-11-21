/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(fileURLToPath(import.meta.url));
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(packageDir, '../tokens.css'), 'utf8');

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
});
