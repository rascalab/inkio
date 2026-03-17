'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Editor as InkioEditor,
  Viewer as InkioViewer,
  type InkioMessageOverrides,
  type TiptapEditor,
  type CommentConfig,
} from '@inkio/editor';
import { inkioIconRegistry, type InkioIconRegistry } from '@inkio/editor/icons';
import {
  type CommentPanelProps,
  type CommentMessage,
  type CommentThreadData,
} from '@inkio/advanced';
import type { ImageEditorModalProps } from '@inkio/image-editor';

const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);

const LazyCommentPanel = dynamic<CommentPanelProps>(
  () => import('@inkio/advanced').then((mod) => mod.CommentPanel),
  { loading: () => <div className="playground-loading">Loading comments...</div> },
);

const EDITOR_CONTENT = `<h2>Inkio Editor Playground</h2>
<p>Opinionated notion-like preset for production content workflows.</p>
<ul>
  <li><code>/</code> for slash commands</li>
  <li><code>#</code> for hashtag suggestions</li>
  <li><code>[[page]]</code> for wiki links</li>
  <li>Select text and press <code>Mod+Shift+M</code> for comments</li>
  <li>Drag &amp; drop images to test the image editor</li>
</ul>`;

function createId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type PlaygroundEditorPaneProps = {
  initialContent?: string;
  showViewer: boolean;
  showJSON: boolean;
};

export default function PlaygroundEditorPane({
  initialContent,
  showViewer,
  showJSON,
}: PlaygroundEditorPaneProps) {
  const [content, setContent] = useState<unknown>(null);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [commentThreads, setCommentThreads] = useState<CommentThreadData[]>([]);
  const commentThreadsRef = useRef<CommentThreadData[]>([]);
  commentThreadsRef.current = commentThreads;

  const locale = 'en-US,en;q=0.9';
  const iconOverrides = useMemo<Partial<InkioIconRegistry>>(
    () => ({ comment: inkioIconRegistry.comment }),
    [],
  );
  const messages = useMemo<InkioMessageOverrides>(
    () => ({
      core: {
        suggestion: { empty: 'No matching items.' },
      },
      extensions: {
        commentComposer: { placeholder: 'Share feedback...' },
      },
    }),
    [],
  );

  const handleReply = useCallback((threadId: string, text: string) => {
    const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
    setCommentThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, messages: [...thread.messages, message] } : thread,
      ),
    );
  }, []);

  const handleResolve = useCallback((threadId: string) => {
    setCommentThreads((prev) =>
      prev.map((thread) => (thread.id === threadId ? { ...thread, resolved: true } : thread)),
    );
  }, []);

  const handleDelete = useCallback((threadId: string) => {
    setCommentThreads((prev) => prev.filter((thread) => thread.id !== threadId));
  }, []);

  const comment = useMemo<CommentConfig>(
    () => ({
      onSubmit: (commentId: string, text: string) => {
        const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
        setCommentThreads((prev) => [...prev, { id: commentId, messages: [message], resolved: false }]);
      },
      getComments: (commentId: string) =>
        commentThreadsRef.current.find((thread) => thread.id === commentId) ?? null,
      onReply: handleReply,
      onResolve: handleResolve,
      onDelete: handleDelete,
    }),
    [handleDelete, handleReply, handleResolve],
  );

  return (
    <>
      <section className="playground-section">
        <div className="playground-section-label">
          Editor
          <span className="playground-mode-badge">
            @inkio/editor + lazy comments + lazy @inkio/image-editor
          </span>
        </div>
        <InkioEditor
          initialContent={initialContent ?? EDITOR_CONTENT}
          placeholder="Try /, #, [[page]], comments, and image editing..."
          locale={locale}
          ui={{
            showBubbleMenu: true,
            showFloatingMenu: true,
            messages,
            icons: iconOverrides,
          }}
          hashtagItems={({ query }: { query: string }) => {
            const tags = ['inkio', 'tiptap', 'editor', 'react', 'markdown', 'playground'];
            return tags
              .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
              .map((tag) => ({ id: tag, label: `#${tag}` }));
          }}
          onImageUpload={async (file: File) => URL.createObjectURL(file)}
          imageBlock={{ imageEditor: LazyImageEditorModal }}
          comment={comment}
          onCreate={setEditorInstance}
          onUpdate={(next: unknown) => setContent(next)}
        />
      </section>

      {showViewer && content && (
        <section className="playground-section">
          <div className="playground-section-label">Viewer</div>
          <InkioViewer content={content} />
        </section>
      )}

      {showJSON && content && (
        <section className="playground-section">
          <div className="playground-section-label">JSON Output</div>
          <pre className="playground-json">{JSON.stringify(content, null, 2)}</pre>
        </section>
      )}

      <section className="playground-section">
        <div className="playground-section-label">Comments</div>
        <LazyCommentPanel
          editor={editorInstance}
          threads={commentThreads}
          locale={locale}
          messages={messages}
          icons={iconOverrides}
          onReply={handleReply}
          onResolve={handleResolve}
          onDelete={handleDelete}
          currentUser="You"
        />
      </section>
    </>
  );
}
