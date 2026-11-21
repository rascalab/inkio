'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Editor as SimpleEditor,
  Viewer as SimpleViewer,
} from '@inkio/simple';
import type { TiptapEditor } from '@inkio/core';
import { PLAYGROUND_INITIAL_CONTENT, type PlaygroundLocale } from './playground-content';
import PlaygroundJson from './PlaygroundJson';
import { usePlaygroundDocument } from './use-playground-document';
import { useObjectUrlRegistry } from './use-object-urls';
import { LazyImageEditorModal } from './lazy-image-editor-modal';

type PlaygroundSimplePaneProps = {
  content?: string;
  locale: PlaygroundLocale;
  active: boolean;
  showViewer: boolean;
  showJSON: boolean;
};

export default function PlaygroundSimplePane({
  content: initialDoc,
  locale,
  active,
  showViewer,
  showJSON,
}: PlaygroundSimplePaneProps) {
  const initialContent = initialDoc ?? PLAYGROUND_INITIAL_CONTENT;
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const doc = usePlaygroundDocument(editorInstance, active && (showViewer || showJSON));
  const createObjectUrl = useObjectUrlRegistry();
  const handleImageUpload = useCallback(
    async (file: File) => createObjectUrl(file),
    [createObjectUrl],
  );
  const imageBlock = useMemo(() => ({ imageEditor: LazyImageEditorModal }), []);

  return (
    <>
      <section className="playground-section">
        <div className="playground-section-heading">
          <h2 className="playground-section-label">Editor</h2>
          <span className="playground-mode-badge">@inkio/simple + lazy @inkio/image-editor</span>
        </div>
        <SimpleEditor
          content={initialContent}
          placeholder={locale === 'ko' ? '문서를 작성해 보세요...' : 'Write a document...'}
          locale={locale}
          onImageUpload={handleImageUpload}
          imageBlock={imageBlock}
          ui={{ autoresize: true, showToolbar: true }}
          onCreate={setEditorInstance}
        />
      </section>

      {active && showViewer && (
        <section className="playground-section">
          <h2 className="playground-section-label">Viewer</h2>
          <SimpleViewer content={doc ?? initialContent} locale={locale} />
        </section>
      )}

      {active && showJSON && <PlaygroundJson content={doc} />}
    </>
  );
}
