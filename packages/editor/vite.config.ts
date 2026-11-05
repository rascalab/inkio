import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyCss } from '../../scripts/vite-css-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';

export default defineConfig({
  plugins: [
    react(),
    ...(enableDts
      ? [
          dts({
            entryRoot: 'src',
            compilerOptions: { rootDir: resolve(__dirname, 'src'), paths: {} },
            include: ['src'],
            exclude: [
              'src/**/__tests__/**',
              'src/**/*.test.ts',
              'src/**/*.test.tsx',
            ],
            insertTypesEntry: true,
            pathsToAliases: false,
            aliasesExclude: [/^@inkio\//],
          }),
        ]
      : []),
    copyCss(__dirname),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
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
        if (id === '@inkio/core' || id.startsWith('@inkio/core/')) return true;
        if (id === '@inkio/advanced' || id.startsWith('@inkio/advanced/')) return true;
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
