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

const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);

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
  const [content, handleUpdate] = useDebouncedState<unknown>(
    initialContent ?? PLAYGROUND_INITIAL_CONTENT,
  );
  const handleImageUpload = useCallback(async (file: File) => URL.createObjectURL(file), []);
  const imageBlock = useMemo(() => ({ imageEditor: LazyImageEditorModal }), []);

  return (
    <>
      <section className="playground-section">
        <div className="playground-section-label">
          Editor
          <span className="playground-mode-badge">@inkio/simple + lazy @inkio/image-editor</span>
        </div>
        <SimpleEditor
          initialContent={initialContent ?? PLAYGROUND_INITIAL_CONTENT}
          placeholder="Write a document..."
          locale="en-US,en;q=0.9"
          onImageUpload={handleImageUpload}
          imageBlock={imageBlock}
          ui={{ autoresize: true, showToolbar: true }}
          onUpdate={handleUpdate}
        />
      </section>

      {showViewer && content && (
        <section className="playground-section">
          <div className="playground-section-label">Viewer</div>
          <SimpleViewer content={content as InkioJSONContent} />
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
