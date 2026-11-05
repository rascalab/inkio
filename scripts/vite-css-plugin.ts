import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

function inlineCssImports(filePath: string, stack: string[] = []): string {
  const resolved = resolve(filePath);
  // Cycle detection follows the current DFS path only: a shared visited set
  // mistakes diamond imports (A->B,A->C,B->D,C->D) for a cycle.
  if (stack.includes(resolved)) {
    throw new Error(`CSS import cycle detected: ${[...stack, resolved].join(' -> ')}`);
  }
  let content: string;
  try {
    content = readFileSync(resolved, 'utf-8');
  } catch (error) {
    const importer = stack.length > 0 ? stack[stack.length - 1] : '(entry)';
    throw new Error(
      `CSS import failed: cannot read ${resolved} (imported from ${importer}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const dir = dirname(resolved);
  const next = [...stack, resolved];
  return content.replace(/@import\s+["'](\.[^"']+)["']\s*;/g, (_match, rel) => {
    return inlineCssImports(resolve(dir, rel), next);
  });
}

/** Collect all CSS files in the @import chain. */
function collectCssFiles(filePath: string, visited = new Set<string>()): string[] {
  const resolved = resolve(filePath);
  if (visited.has(resolved)) return [];
  visited.add(resolved);
  const content = readFileSync(resolved, 'utf-8');
  const dir = dirname(resolved);
  const files = [resolved];
  content.replace(/@import\s+["'](\.[^"']+)["']\s*;/g, (_match, rel) => {
    files.push(...collectCssFiles(resolve(dir, rel), visited));
    return '';
  });
  return files;
}

/** Emits a package's `src/minimal.css` and `src/style.css` with their imports inlined. */
export function copyCss(packageDir: string): Plugin {
  const entries = ['minimal.css', 'style.css'];
  return {
    name: 'copy-css',
    buildStart() {
      const files = new Set(entries.flatMap((entry) => collectCssFiles(resolve(packageDir, 'src', entry))));
      for (const file of files) {
        this.addWatchFile(file);
      }
    },
    generateBundle() {
      for (const fileName of entries) {
        this.emitFile({ type: 'asset', fileName, source: inlineCssImports(resolve(packageDir, 'src', fileName)) });
      }
    },
  };
}
