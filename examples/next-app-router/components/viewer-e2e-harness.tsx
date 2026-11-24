'use client';

import { useState } from 'react';
import { Editor, Viewer, type ViewerProps } from '@inkio/editor';
import { StaticViewer } from '@inkio/core/static';
import { getAdvancedViewerExtensions } from '@inkio/advanced';

const initialContent = '<p style="text-align:center"><span style="color:#125678">Viewer harness</span></p>';
const advancedSchema = getAdvancedViewerExtensions();

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
      <section className="demo-card" data-testid="static-preview">
        <StaticViewer content={doc} extensions={advancedSchema} />
      </section>
    </main>
  );
}
