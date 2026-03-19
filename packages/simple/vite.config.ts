import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';

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
            include: ['src'],
            exclude: [
              'src/**/__tests__/**',
              'src/**/*.test.ts',
              'src/**/*.test.tsx',
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
    alias: [
      { find: /^@inkio\/core\/icons$/, replacement: resolve(__dirname, '../core/src/icons/index.ts') },
      { find: /^@inkio\/core\/markdown$/, replacement: resolve(__dirname, '../core/src/markdown/index.ts') },
      { find: /^@inkio\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  build: {
    outDir: process.env.INKIO_VITE_OUT_DIR ?? 'dist',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        icons: resolve(__dirname, 'src/icons.ts'),
        markdown: resolve(__dirname, 'src/markdown/index.ts'),
      },
    },
    rollupOptions: {
      external: (id) => {
        if (id === 'react' || id.startsWith('react/')) return true;
        if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
        if (id === '@inkio/core' || id.startsWith('@inkio/core/')) return true;
        return false;
      },
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
        },
      ],
    },
    copyPublicDir: false,
  },
});
