'use client';

import { useState } from 'react';
import { Editor, Viewer, type ViewerProps } from '@inkio/editor';

const initialContent = '<p>Viewer harness</p>';

export function ViewerE2EHarness() {
  const [doc, setDoc] = useState<ViewerProps['content']>(initialContent);

  return (
    <main className="page-shell">
      <section className="demo-card" data-testid="viewer-e2e-editor">
        <p className="section-title">Editor</p>
        <Editor content={initialContent} onUpdate={setDoc} />
      </section>
      <section className="demo-card" data-testid="viewer-e2e-viewer">
        <p className="section-title">Viewer</p>
        <Viewer content={doc} />
      </section>
    </main>
  );
}
