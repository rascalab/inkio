'use client';

import { useState } from 'react';
import { Editor, type EditorProps } from '@inkio/editor';
import { MarkdownPaste } from '@inkio/editor/markdown';

const content = `
  <p>앞 문단</p>
  <ul><li><p>하나</p></li><li><p>둘</p></li></ul>
  <p>끝 문단</p>
  <pre><code>코드</code></pre>
`;
const extensions = [MarkdownPaste];
const themeProbe = '<pre><code class="language-javascript">const color = 1;</code></pre><p></p>';
const customMenuLayout: EditorProps['ui'] = {
  fill: true,
  style: { height: 360 },

  toolbar: { placement: 'bottom' },
  bubbleMenu: { position: { placement: 'bottom', offset: 16, flip: false } },
  floatingMenu: { position: { placement: 'right', offset: 24, flip: false } },
  tableMenu: { position: { placement: 'left', offset: 12 } },
};

export function BlockE2EHarness() {
  const [customLayout, setCustomLayout] = useState(false);
  const [compareThemes, setCompareThemes] = useState(false);
  return (
    <main className="page-shell">
      <section className="demo-card">
        <label>
          <input type="checkbox" checked={customLayout} onChange={(event) => setCustomLayout(event.target.checked)} />
          Custom menu layout
        </label>
        <Editor content={content} locale="ko" extensions={extensions} ui={customLayout ? customMenuLayout : undefined} />
        <label>
          <input type="checkbox" checked={compareThemes} onChange={(event) => setCompareThemes(event.target.checked)} />
          Compare themes
        </label>
        {compareThemes && (
          <div className="dark-theme">
            <div data-testid="theme-probe-light"><Editor content={themeProbe} theme="light" /></div>
            <div data-testid="theme-probe-dark"><Editor content={themeProbe} /></div>
          </div>
        )}
      </section>
    </main>
  );
}
