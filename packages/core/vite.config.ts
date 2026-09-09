import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';
const require = createRequire(import.meta.url);
// decode-named-character-reference ships a DOM-only entry (index.dom.js) for
// the bundler "browser" condition that touches `document` at module scope.
// The universal entry (index.js) is behavior-identical in browsers and safe
// under Node SSR, so force it for the dist bundle.
// require.resolve uses Node conditions ("default" -> index.js), never the
// bundler "browser" condition, so this always yields the universal entry.
const decodeNamedCharacterReferencePath = require.resolve('decode-named-character-reference');

/** Read a CSS file and recursively inline its @import "./..." statements. */
function inlineCssImports(filePath: string, visited = new Set<string>()): string {
  const resolved = resolve(filePath);
  if (visited.has(resolved)) throw new Error(`CSS import cycle detected: ${resolved}`);
  visited.add(resolved);
  const content = readFileSync(resolved, 'utf-8');
  const dir = dirname(resolved);
  return content.replace(/@import\s+["'](\.[^"']+)["']\s*;/g, (_match, rel) => {
    return inlineCssImports(resolve(dir, rel), visited);
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

export default defineConfig({
  plugins: [
    react(),
    ...(enableDts
      ? [
          dts({
            entryRoot: 'src',
            compilerOptions: { rootDir: resolve(__dirname, 'src') },
            include: ['src'],
            exclude: [
              'src/**/__tests__/**',
              'src/**/*.test.ts',
              'src/**/*.test.tsx',
              'src/test-setup.ts',
            ],
            insertTypesEntry: true,
          }),
        ]
      : []),
    {
      name: 'copy-css',
      buildStart() {
        const cssFiles = new Set([
          ...collectCssFiles(resolve(__dirname, 'src/minimal.css')),
          ...collectCssFiles(resolve(__dirname, 'src/style.css')),
        ]);
        for (const file of cssFiles) {
          this.addWatchFile(file);
        }
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'minimal.css',
          source: inlineCssImports(resolve(__dirname, 'src/minimal.css')),
        });
        this.emitFile({
          type: 'asset',
          fileName: 'style.css',
          source: inlineCssImports(resolve(__dirname, 'src/style.css')),
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'decode-named-character-reference': decodeNamedCharacterReferencePath,
    },
  },
  build: {
    outDir: process.env.INKIO_VITE_OUT_DIR ?? 'dist',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        icons: resolve(__dirname, 'src/icons/index.ts'),
        markdown: resolve(__dirname, 'src/markdown/index.ts'),
      },
    },
    rollupOptions: {
      external: (id) => {
        if (id === 'react' || id.startsWith('react/')) return true;
        if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
        if (id.startsWith('@tiptap/')) return true;
        if (id.startsWith('@radix-ui/')) return true;
        return false;
      },
      output: [
        {
          format: 'es',
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        {
          format: 'cjs',
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      ],
    },
    copyPublicDir: false,
  },
});
