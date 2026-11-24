import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Use the same Vite version as the libraries, but consume their built public
// exports as an app would (no source aliases or library-mode externals).
const coreManifest = new URL('../packages/core/package.json', import.meta.url);
const { build } = createRequire(coreManifest)('vite');
const packages = fileURLToPath(new URL('../packages/', import.meta.url));

for (const pkg of ['simple', 'editor']) {
  for (const name of ['read', 'Viewer', 'Editor']) {
    const root = path.join(packages, pkg);
    const entry = path.join(root, 'consumer-fixture.js');
    const consume = name === 'read'
      ? 'globalThis.result = read(globalThis.doc).text;'
      : `import { createElement } from 'react';
         import { createRoot } from 'react-dom/client';
         createRoot(document.getElementById('app')).render(createElement(${name}, { content: '<p>Inkio</p>' }));`;
    const { output } = await build({
      configFile: false,
      logLevel: 'error',
      root,
      plugins: [{
        name: 'editor-consumer',
        resolveId: id => id === entry ? id : null,
        load: id => id === entry ? `import { ${name} } from '@inkio/${pkg}';\n${consume}` : null,
      }],
      build: { write: false, modulePreload: { polyfill: false }, rolldownOptions: { input: entry } },
    });
    const chunks = new Map(output.filter(item => item.type === 'chunk').map(chunk => [chunk.fileName, chunk]));
    const initial = new Set();
    function include(chunk) {
      if (initial.has(chunk)) return;
      initial.add(chunk);
      for (const imported of chunk.imports) include(chunks.get(imported));
    }
    include([...chunks.values()].find(chunk => chunk.isEntry));
    let bytes = 0, gzip = 0, totalGzip = 0;
    for (const chunk of chunks.values()) {
      const compressed = gzipSync(chunk.code).length;
      totalGzip += compressed;
      if (initial.has(chunk)) {
        bytes += Buffer.byteLength(chunk.code);
        gzip += compressed;
      }
    }
    console.log(`[consumer] @inkio/${pkg} ${name}: initial ${bytes} B / ${gzip} B gzip; all JS ${totalGzip} B gzip`);
    if (name === 'read') {
      // The seven projections include nested block counting, custom schema support and
      // stack-safe traversal. Keep their cost bounded without bundling any dependency.
      for (const chunk of chunks.values()) {
        for (const [id, info] of Object.entries(chunk.modules)) {
          if (info.renderedLength && id.includes('/node_modules/')) throw new Error(`Document reader bundled ${id}`);
        }
      }
      if (totalGzip > 2_850) throw new Error('Document reader exceeded 2,850 bytes gzip');
    }
    // A read-only import must not pull the editable preset's menus back in.
    if (name === 'Viewer' && gzip > (pkg === 'simple' ? 310_000 : 328_000)) {
      throw new Error(`@inkio/${pkg} Viewer exceeded its initial JS budget`);
    }
  }
}
