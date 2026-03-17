import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';

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

export default defineConfig({
  plugins: [
    react(),
    ...(enableDts
      ? [
          dts({
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
