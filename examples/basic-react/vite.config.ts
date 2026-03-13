import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('/@inkio/editor/') ||
            id.includes('/@tiptap/') ||
            id.includes('/@radix-ui/') ||
            id.includes('/prosemirror-') ||
            id.includes('/orderedmap/') ||
            id.includes('/rope-sequence/') ||
            id.includes('/w3c-keyname/') ||
            id.includes('/clsx/') ||
            id.includes('/tailwind-merge/') ||
            id.includes('/lucide-react/')
          ) {
            return 'editor-vendor';
          }

          return undefined;
        },
      },
    },
  },
});
