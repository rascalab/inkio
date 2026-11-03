'use client';

import { Editor } from '@inkio/editor';
import { MarkdownPaste } from '@inkio/editor/markdown';

const content = `
  <p>앞 문단</p>
  <ul><li><p>하나</p></li><li><p>둘</p></li></ul>
  <p>끝 문단</p>
  <pre><code>코드</code></pre>
`;
const extensions = [MarkdownPaste];

export function BlockE2EHarness() {
  return (
    <main className="page-shell">
      <section className="demo-card">
        <Editor content={content} locale="ko" extensions={extensions} />
      </section>
    </main>
  );
}
