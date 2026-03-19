import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';


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
            rollupTypes: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: [
      { find: /^@inkio\/core\/icons$/, replacement: resolve(__dirname, '../core/src/icons/index.ts') },
      { find: /^@inkio\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  build: {
    outDir: process.env.INKIO_VITE_OUT_DIR ?? 'dist',
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
