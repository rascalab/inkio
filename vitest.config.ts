import { defineConfig } from 'vitest/config';

// One shared worker pool: parallel per-package runs oversubscribe the CPU and time out jsdom tests.
export default defineConfig({
  test: {
    projects: [
      'packages/core',
      'packages/advanced',
      'packages/simple',
      'packages/editor',
      'packages/image-editor',
      'packages/collab',
    ],
  },
});
