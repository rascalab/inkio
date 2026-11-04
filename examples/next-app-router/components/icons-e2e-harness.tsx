'use client';

import { forwardRef } from 'react';
import { Editor } from '@inkio/editor';
import { inkioIconRegistry } from '@inkio/editor/icons';
import { MarkdownPaste } from '@inkio/editor/markdown';

// Every registry id answered by one mark, so the spec can find any icon that
// did not come through the registry.
const Mark = forwardRef<SVGSVGElement, { size?: number | string }>(function Mark({ size }, ref) {
  return <svg ref={ref} data-app-icon width={size} height={size} aria-hidden />;
});

const icons = Object.fromEntries(Object.keys(inkioIconRegistry).map((id) => [id, Mark]));
const ui = { icons };
const extensions = [MarkdownPaste];
const content = `
  <p>앞 문단</p>
  <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>할 일</p></li></ul>
  <pre><code>코드</code></pre>
  <table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>다</p></td><td><p>라</p></td></tr></tbody></table>
  <p>끝 문단</p>
`;

export function IconsE2EHarness() {
  return (
    <main className="page-shell">
      <section className="demo-card">
        <Editor content={content} locale="ko" ui={ui} extensions={extensions} />
      </section>
    </main>
  );
}
