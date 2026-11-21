import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const useSourcePackages = process.env.INKIO_USE_SOURCE_PACKAGES === '1';
const source = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: useSourcePackages
      ? [
          { find: /^@inkio\/simple\/style\.css$/, replacement: source('simple/src/style.css') },
          { find: /^@inkio\/core\/icons$/, replacement: source('core/src/icons/index.ts') },
          { find: /^@inkio\/simple$/, replacement: source('simple/src/index.ts') },
          { find: /^@inkio\/core$/, replacement: source('core/src/index.ts') },
        ]
      : [],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /\/node_modules\/(?:react(?:-dom)?|scheduler)\// },
            { name: 'tiptap-vendor', test: /\/node_modules\/(?:@tiptap\/|prosemirror-[^/]+\/|orderedmap\/|rope-sequence\/|w3c-keyname\/)/ },
          ],
        },
      },
    },
  },
});
