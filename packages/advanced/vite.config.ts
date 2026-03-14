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
  return content.replace(/@import\s+["']([^"']+)["']\s*;/g, (_match, rel) => {
    if (!rel.startsWith('.')) {
      return `@import "${rel}";`;
    }

    return inlineCssImports(resolve(dir, rel), visited);
  });
}

const entries = {
  index: resolve(__dirname, 'src/index.ts'),
  'block-handle': resolve(__dirname, 'src/entries/block-handle.ts'),
  bookmark: resolve(__dirname, 'src/entries/bookmark.ts'),
  mention: resolve(__dirname, 'src/entries/mention.ts'),
  hashtag: resolve(__dirname, 'src/entries/hashtag.ts'),
  'slash-command': resolve(__dirname, 'src/entries/slash-command.ts'),
  wikilink: resolve(__dirname, 'src/entries/wikilink.ts'),
  comment: resolve(__dirname, 'src/entries/comment.ts'),
};

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      insertTypesEntry: true,
      rollupTypes: false,
    }),
    {
      name: 'copy-css',
      generateBundle() {
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
      { find: /^@inkio\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: /^@inkio\/essential$/, replacement: resolve(__dirname, '../essential/src/index.ts') },
      { find: /^@inkio\/essential\//, replacement: `${resolve(__dirname, '../essential/src')}/` },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  build: {
    lib: {
      entry: entries,
      name: 'InkioExtensions',
    },
    rollupOptions: {
      external: (id) => {
        if (id === 'react' || id.startsWith('react/')) return true;
        if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
        if (id.startsWith('@tiptap/')) return true;
        if (id.startsWith('@radix-ui/')) return true;
        if (id === '@inkio/core' || id.startsWith('@inkio/core/')) return true;
        if (id === '@inkio/essential' || id.startsWith('@inkio/essential/')) return true;
        return false;
      },
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      ],
    },
    copyPublicDir: false,
  },
});
