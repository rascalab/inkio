import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entries = {
  index: resolve(__dirname, 'src/index.ts'),
  mention: resolve(__dirname, 'src/entries/mention.ts'),
  hashtag: resolve(__dirname, 'src/entries/hashtag.ts'),
  'slash-command': resolve(__dirname, 'src/entries/slash-command.ts'),
  wikilink: resolve(__dirname, 'src/entries/wikilink.ts'),
  callout: resolve(__dirname, 'src/entries/callout.ts'),
  image: resolve(__dirname, 'src/entries/image.ts')
};

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
      rollupTypes: false,
    }),
    {
      name: 'copy-css',
      generateBundle() {
        const cssFiles = [
          'src/styles-extensions.css',
          'src/styles-block-handle.css',
          'src/styles-image-editor.css',
        ];
        const combined = cssFiles
          .map((f) => readFileSync(resolve(__dirname, f), 'utf-8'))
          .join('\n');
        this.emitFile({
          type: 'asset',
          fileName: 'style.css',
          source: combined,
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
    lib: {
      entry: entries,
      name: 'InkioExtensions',
    },
    rollupOptions: {
      external: (id) => {
        if (id === 'react' || id.startsWith('react/')) return true;
        if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
        if (id === 'lucide-react' || id.startsWith('lucide-react/')) return true;
        if (id.startsWith('@tiptap/')) return true;
        if (id.startsWith('@radix-ui/')) return true;
        if (id === '@inkio/editor') return true;
        if (id === 'katex' || id.startsWith('katex/')) return true;
        if (id === 'konva' || id.startsWith('konva/')) return true;
        if (id === 'react-konva' || id.startsWith('react-konva/')) return true;
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
