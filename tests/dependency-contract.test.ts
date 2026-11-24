import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import corePackage from '../packages/core/package.json';
import advancedPackage from '../packages/advanced/package.json';
import simplePackage from '../packages/simple/package.json';
import editorPackage from '../packages/editor/package.json';
import imageEditorPackage from '../packages/image-editor/package.json';
import collabPackage from '../packages/collab/package.json';

const packages = [corePackage, advancedPackage, simplePackage, editorPackage, imageEditorPackage, collabPackage];
const byName = new Map<string, (typeof packages)[number]>(packages.map(pkg => [pkg.name, pkg]));
const packagesDir = fileURLToPath(new URL('../packages', import.meta.url));
// Use the TypeScript parser already installed by core; no second compiler dependency.
const { preProcessFile } = createRequire(new URL('../packages/core/package.json', import.meta.url))('typescript') as {
  preProcessFile(source: string, readImports: boolean, detectJavaScriptImports: boolean): {
    importedFiles: { fileName: string }[];
  };
};

function imports(path: string): string[] {
  const source = readFileSync(path, 'utf-8');
  if (path.endsWith('.css')) {
    return Array.from(source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@import\s+(?:url\(\s*)?(["'])([^"']+)\1/g), match => match[2]);
  }
  return preProcessFile(source, true, true).importedFiles.map(entry => entry.fileName);
}

function isInside(dir: string, path: string) {
  const rest = relative(dir, path);
  return !isAbsolute(rest) && rest !== '..' && !rest.startsWith(`..${sep}`);
}

describe('layered package dependency contract', () => {
  it('keeps runtime package edges layered and Vite optional for collaboration users', () => {
    const inkioEdges = (field: Record<string, string>) => Object.keys(field)
      .filter(name => name.startsWith('@inkio/'))
      .sort();

    expect(packages
      .map(pkg => ({
        package: pkg.name,
        dependsOn: inkioEdges(pkg.dependencies),
        peers: inkioEdges(pkg.peerDependencies),
      }))).toEqual([
      { package: '@inkio/core', dependsOn: [], peers: [] },
      { package: '@inkio/advanced', dependsOn: ['@inkio/core'], peers: [] },
      { package: '@inkio/simple', dependsOn: ['@inkio/core'], peers: [] },
      { package: '@inkio/editor', dependsOn: ['@inkio/advanced', '@inkio/core'], peers: [] },
      { package: '@inkio/image-editor', dependsOn: [], peers: ['@inkio/core'] },
      { package: '@inkio/collab', dependsOn: [], peers: ['@inkio/core'] },
    ]);
    expect(collabPackage.dependencies).not.toHaveProperty('vite');
    expect(collabPackage.peerDependencies.vite).toBe('*');
    expect(collabPackage.peerDependenciesMeta.vite.optional).toBe(true);
  });

  it('only imports other packages through their declared, public entrypoints', () => {
    const violations: string[] = [];
    for (const pkg of packages) {
      const pkgDir = join(packagesDir, pkg.name.slice('@inkio/'.length));
      const src = join(pkgDir, 'src');
      for (const file of readdirSync(src, { recursive: true, withFileTypes: true })) {
        if (!file.isFile() || !/\.(?:[cm]?[jt]sx?|css)$/.test(file.name)) continue;
        const path = join(file.parentPath, file.name);
        const parts = relative(src, path).split(sep);
        if (parts.some(part => part === '__tests__' || part === '__fixtures__') || /\.(test|spec)\./.test(file.name)) continue;
        for (const specifier of imports(path)) {
          const label = `${relative(packagesDir, path)} → ${specifier}`;
          if (specifier.startsWith('.') || specifier.startsWith('@/')) {
            const target = specifier.startsWith('@/') ? resolve(src, specifier.slice(2)) : resolve(dirname(path), specifier);
            if (!isInside(pkgDir, target)) violations.push(`${label}: private path outside the package`);
            continue;
          }
          if (!specifier.startsWith('@inkio/')) continue;
          const [, scope, name, subpath] = /^(@inkio)\/([^/]+)(?:\/(.+))?$/.exec(specifier) ?? [];
          const dependency = `${scope}/${name}`;
          const target = byName.get(dependency);
          if (!target || !Object.hasOwn(target.exports, subpath ? `./${subpath}` : '.')) {
            violations.push(`${label}: not a public export`);
          }
          if (dependency !== pkg.name && !(dependency in pkg.dependencies) && !(dependency in pkg.peerDependencies)) {
            violations.push(`${label}: not a runtime or peer dependency`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps React as a peer and owns runtime packages internally', () => {
    const packages = [corePackage, advancedPackage, simplePackage, editorPackage];

    packages.forEach((pkg) => {
      expect(pkg.peerDependencies).toEqual({
        react: '^18.0.0 || ^19.0.0',
        'react-dom': '^18.0.0 || ^19.0.0',
      });

      Object.keys(pkg.peerDependencies ?? {}).forEach((name) => {
        expect(name.startsWith('@tiptap/')).toBe(false);
      });
    });

    expect(imageEditorPackage.peerDependencies).toEqual({
      '@inkio/core': 'workspace:^',
      react: '^19.3.0',
      'react-dom': '^19.3.0',
    });

    expect(corePackage.dependencies).toMatchObject({
      '@tiptap/extension-color': expect.any(String),
      '@tiptap/extension-text-align': expect.any(String),
      '@tiptap/extension-subscript': expect.any(String),
      '@tiptap/extension-superscript': expect.any(String),
      '@tiptap/extension-text-style': expect.any(String),
      'lucide': expect.any(String),
      'remark-directive': expect.any(String),
      'remark-gfm': expect.any(String),
      'remark-parse': expect.any(String),
      'remark-stringify': expect.any(String),
      'unified': expect.any(String),
    });

    expect(editorPackage.dependencies).toMatchObject({
      '@inkio/core': 'workspace:^',
      '@inkio/advanced': 'workspace:^',
    });

    expect(advancedPackage.dependencies).toMatchObject({
      '@inkio/core': 'workspace:^',
      '@tiptap/extension-mention': expect.any(String),
    });

    expect(simplePackage.dependencies).toMatchObject({
      '@inkio/core': 'workspace:^',
    });

    expect(imageEditorPackage.dependencies).toMatchObject({
      'konva': expect.any(String),
      'react-konva': expect.any(String),
    });

    expect(corePackage.devDependencies).toMatchObject({
      react: expect.any(String),
      'react-dom': expect.any(String),
    });

    expect(editorPackage.dependencies).not.toMatchObject({
      '@tiptap/extension-color': expect.any(String),
      '@tiptap/extension-text-style': expect.any(String),
    });

    const removedMarkdownBridgePackages = [
      ['mar', 'ked'].join(''),
      ['tu', 'rnd', 'own'].join(''),
      `${['tu', 'rnd', 'own'].join('')}-plugin-gfm`,
    ];
    removedMarkdownBridgePackages.forEach((name) => {
      expect(corePackage.dependencies).not.toHaveProperty(name);
    });
  });
});
