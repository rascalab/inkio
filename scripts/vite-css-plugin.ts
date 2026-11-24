import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

function resolveCssImport(packagesDir: string, importer: string, specifier: string): string {
  if (specifier.startsWith('.')) return resolve(dirname(importer), specifier);

  const [, name, asset] = /^@inkio\/([a-z-]+)\/([a-z-]+\.css)$/.exec(specifier) ?? [];
  if (!name || !asset) throw new Error(`Unsupported Inkio stylesheet import ${specifier} in ${importer}`);
  const pkgDir = resolve(packagesDir, name);
  const { exports } = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf-8'));
  if (exports?.[`./${asset}`] !== `./dist/${asset}`) {
    throw new Error(`Inkio stylesheet ${specifier} is not exported (imported from ${importer})`);
  }
  // Assemble release styles from public source entries even in parallel clean builds.
  return resolve(pkgDir, 'src', asset);
}

function inlineCssImports(filePath: string, packagesDir: string, files: Set<string>, stack: string[] = []): string {
  const resolved = resolve(filePath);
  // Cycle detection follows the current DFS path only: a shared visited set
  // mistakes diamond imports (A->B,A->C,B->D,C->D) for a cycle.
  if (stack.includes(resolved)) {
    throw new Error(`CSS import cycle detected: ${[...stack, resolved].join(' -> ')}`);
  }
  files.add(resolved);
  let content: string;
  try {
    content = readFileSync(resolved, 'utf-8');
  } catch (error) {
    const importer = stack.length > 0 ? stack[stack.length - 1] : '(entry)';
    throw new Error(
      `CSS import failed: cannot read ${resolved} (imported from ${importer}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const next = [...stack, resolved];
  return content.replace(/@import\s+["'](\.[^"']+|@inkio\/[^"']+)["']\s*;/g, (_match, specifier) => {
    return inlineCssImports(resolveCssImport(packagesDir, resolved, specifier), packagesDir, files, next);
  });
}

/** Emits a package's public stylesheets with their imports inlined. */
export function copyCss(packageDir: string, entries = ['minimal.css', 'style.css']): Plugin {
  const packagesDir = resolve(packageDir, '..');
  let assets: { fileName: string; source: string }[];
  return {
    name: 'copy-css',
    buildStart() {
      const files = new Set<string>();
      assets = entries.map((fileName) => ({
        fileName,
        source: inlineCssImports(resolve(packageDir, 'src', fileName), packagesDir, files),
      }));
      for (const file of files) {
        this.addWatchFile(file);
      }
    },
    generateBundle() {
      for (const asset of assets) {
        this.emitFile({ type: 'asset', ...asset });
      }
    },
  };
}
