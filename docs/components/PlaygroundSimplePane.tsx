'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import {
  Editor as SimpleEditor,
  Viewer as SimpleViewer,
} from '@inkio/simple';
import type { InkioJSONContent } from '@inkio/core';
import type { ImageEditorModalProps } from '@inkio/image-editor';
import { PLAYGROUND_INITIAL_CONTENT } from './playground-content';
import { useDebouncedState } from './use-debounced-state';
import { useObjectUrlRegistry } from './use-object-urls';

const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);

type PlaygroundSimplePaneProps = {
  content?: string;
  showViewer: boolean;
  showJSON: boolean;
};

export default function PlaygroundSimplePane({
  content: initialDoc,
  showViewer,
  showJSON,
}: PlaygroundSimplePaneProps) {
  const [doc, handleUpdate] = useDebouncedState<unknown>(
    initialDoc ?? PLAYGROUND_INITIAL_CONTENT,
  );
  const createObjectUrl = useObjectUrlRegistry();
  const handleImageUpload = useCallback(
    async (file: File) => createObjectUrl(file),
    [createObjectUrl],
  );
  const imageBlock = useMemo(() => ({ imageEditor: LazyImageEditorModal }), []);

  return (
    <>
      <section className="playground-section">
        <div className="playground-section-label">
          Editor
          <span className="playground-mode-badge">@inkio/simple + lazy @inkio/image-editor</span>
        </div>
        <SimpleEditor
          content={doc ?? PLAYGROUND_INITIAL_CONTENT}
          placeholder="Write a document..."
          locale="en-US,en;q=0.9"
          onImageUpload={handleImageUpload}
          imageBlock={imageBlock}
          ui={{ autoresize: true, showToolbar: true }}
          onUpdate={handleUpdate}
        />
      </section>

      {showViewer && doc && (
        <section className="playground-section">
          <div className="playground-section-label">Viewer</div>
          <SimpleViewer content={doc as InkioJSONContent} />
        </section>
      )}

      {showJSON && doc && (
        <section className="playground-section">
          <div className="playground-section-label">JSON Output</div>
          <pre className="playground-json">{JSON.stringify(doc, null, 2)}</pre>
        </section>
      )}
    </>
  );
}
