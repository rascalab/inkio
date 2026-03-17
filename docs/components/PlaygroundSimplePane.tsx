'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Editor as SimpleEditor,
  Viewer as SimpleViewer,
} from '@inkio/simple';
import type { ImageEditorModalProps } from '@inkio/image-editor';

const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);

const SIMPLE_CONTENT = `<h2>Inkio Simple Playground</h2>
<p>Classic WYSIWYG preset for regular document editing.</p>
<ul>
  <li>Toolbar-first editing</li>
  <li>Headings, lists, tasks, links, code blocks</li>
  <li>Image uploads with optional image-editor integration</li>
</ul>`;

type PlaygroundSimplePaneProps = {
  initialContent?: string;
  showViewer: boolean;
  showJSON: boolean;
};

export default function PlaygroundSimplePane({
  initialContent,
  showViewer,
  showJSON,
}: PlaygroundSimplePaneProps) {
  const [content, setContent] = useState<unknown>(null);

  return (
    <>
      <section className="playground-section">
        <div className="playground-section-label">
          Editor
          <span className="playground-mode-badge">@inkio/simple + lazy @inkio/image-editor</span>
        </div>
        <SimpleEditor
          initialContent={initialContent ?? SIMPLE_CONTENT}
          placeholder="Write a document..."
          locale="en-US,en;q=0.9"
          onImageUpload={async (file: File) => URL.createObjectURL(file)}
          imageBlock={{ imageEditor: LazyImageEditorModal }}
          ui={{ showToolbar: true }}
          onUpdate={(next: unknown) => setContent(next)}
        />
      </section>

      {showViewer && content && (
        <section className="playground-section">
          <div className="playground-section-label">Viewer</div>
          <SimpleViewer content={content} />
        </section>
      )}

      {showJSON && content && (
        <section className="playground-section">
          <div className="playground-section-label">JSON Output</div>
          <pre className="playground-json">{JSON.stringify(content, null, 2)}</pre>
        </section>
      )}
    </>
  );
}
