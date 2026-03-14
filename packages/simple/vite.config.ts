import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      insertTypesEntry: true,
    }),
    {
      name: 'copy-css',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'style-minimal.css',
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
