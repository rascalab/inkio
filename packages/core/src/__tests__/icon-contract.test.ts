/// <reference types="node" />

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageDir = dirname(fileURLToPath(import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'icons' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('icon contract', () => {
  it('draws every icon through the registry, so an app can replace it', () => {
    const roots = [resolve(packageDir, '..'), resolve(packageDir, '../../../advanced/src')];
    const direct = roots.flatMap(sources).filter((file) => {
      const code = readFileSync(file, 'utf8');
      return /import \{[^}]*\b[A-Z]\w*Icon\b[^}]*\} from '[^']*icons(?:\/index)?'|^\s*<svg\b/m.test(code);
    });
    expect(direct).toEqual([]);
  });
});
