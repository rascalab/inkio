'use client';

import { useCallback, useMemo } from 'react';
import {
  Editor as SimpleEditor,
  Viewer as SimpleViewer,
} from '@inkio/simple';
import type { InkioJSONContent } from '@inkio/core';
import { PLAYGROUND_INITIAL_CONTENT, type PlaygroundLocale } from './playground-content';
import { useDebouncedState } from './use-debounced-state';
import { useObjectUrlRegistry } from './use-object-urls';
import { LazyImageEditorModal } from './lazy-image-editor-modal';

type PlaygroundSimplePaneProps = {
  content?: string;
  locale: PlaygroundLocale;
  showViewer: boolean;
  showJSON: boolean;
};

export default function PlaygroundSimplePane({
  content: initialDoc,
  locale,
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
          placeholder={locale === 'ko' ? '문서를 작성해 보세요...' : 'Write a document...'}
          locale={locale}
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
