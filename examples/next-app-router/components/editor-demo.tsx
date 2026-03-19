'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Editor,
  type InkioMessageOverrides,
  type TiptapEditor,
} from '@inkio/editor';
import { inkioIconRegistry, type InkioIconRegistry } from '@inkio/editor/icons';
import {
  type CommentMessage,
  type CommentPanelProps,
  type CommentData,
  type CommentConfig,
} from '@inkio/advanced';
import type { ImageEditorModalProps } from '@inkio/image-editor';

const LazyCommentPanel = dynamic<CommentPanelProps>(
  () => import('@inkio/advanced').then((mod) => mod.CommentPanel),
  { loading: () => <div className="demo-loading">Loading comments...</div> },
);

const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);

const initialContent = `<h2>Inkio in Next.js</h2>
<p>This example uses the opinionated <code>@inkio/editor</code> package.</p>
<ul>
  <li>Type <code>/</code> for slash commands</li>
  <li>Type <code>#</code> for hashtag suggestions</li>
  <li>Type <code>[[page]]</code> for wiki links</li>
  <li>Select text and press <code>Mod+Shift+M</code> to open comments</li>
  <li>Drop an image to open the image editor flow</li>
</ul>`;

function createId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDemoImageDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create demo image.');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(37, 99, 235, 0.88)';
  context.fillRect(14, 18, 132, 84);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.beginPath();
  context.arc(80, 60, 18, 0, Math.PI * 2);
  context.fill();

  return canvas.toDataURL('image/png');
}

export function EditorDemo() {
  const [json, setJson] = useState<unknown>(null);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const commentsRef = useRef<CommentData[]>([]);
  commentsRef.current = comments;

  const iconOverrides = useMemo<Partial<InkioIconRegistry>>(
    () => ({ comment: inkioIconRegistry.comment }),
    [],
  );
  const locale = 'en-US,en;q=0.9';
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

  const handleReply = useCallback((commentId: string, text: string) => {
    const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId ? { ...comment, messages: [...comment.messages, message] } : comment,
      ),
    );
  }, []);

  const handleResolve = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((comment) => (comment.id === commentId ? { ...comment, resolved: true } : comment)),
    );
  }, []);

  const handleDelete = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
  }, []);

  const handleInsertDemoImage = useCallback(() => {
    if (!editorInstance) {
      return;
    }

    editorInstance
      .chain()
      .focus()
      .setImageBlock({ src: createDemoImageDataUrl(), alt: 'Demo image' })
      .run();
  }, [editorInstance]);

  const comment = useMemo<CommentConfig>(
    () => ({
      onSubmit: (commentId: string, text: string) => {
        const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
        setComments((prev) => [...prev, { id: commentId, messages: [message], resolved: false }]);
      },
      getComments: (commentId: string) =>
        commentsRef.current.find((c) => c.id === commentId) ?? null,
      onReply: handleReply,
      onResolve: handleResolve,
      onDelete: handleDelete,
    }),
    [handleDelete, handleReply, handleResolve],
  );

  return (
    <>
      <section className="demo-card">
        <div className="demo-card-header">
          <p className="section-title">Editor</p>
          <button
            type="button"
            className="demo-action-button"
            data-testid="next-editor-insert-demo-image"
            onClick={handleInsertDemoImage}
            disabled={!editorInstance}
          >
            Insert demo image
          </button>
        </div>
        <Editor
          initialContent={initialContent}
          placeholder="Type /, #, [[page]] and select text for comments..."
          locale={locale}
          hashtagItems={({ query }: { query: string }) => {
            const tags = ['inkio', 'nextjs', 'tiptap', 'editor', 'ai'];
            return tags
              .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
              .map((tag) => ({ id: tag, label: `#${tag}` }));
          }}
          onImageUpload={async (file: File) => URL.createObjectURL(file)}
          imageBlock={{ imageEditor: LazyImageEditorModal }}
          comment={comment}
          ui={{
            showBubbleMenu: true,
            showFloatingMenu: true,
            messages,
            icons: iconOverrides,
          }}
          onCreate={setEditorInstance}
          onUpdate={(next: unknown) => setJson(next)}
        />
      </section>

      <section className="demo-card">
        <p className="section-title">Comments (@inkio/advanced)</p>
        <LazyCommentPanel
          editor={editorInstance}
          threads={comments}
          icons={iconOverrides}
          locale={locale}
          messages={messages}
          currentUser="You"
          onReply={handleReply}
          onResolve={handleResolve}
          onDelete={handleDelete}
        />
      </section>

      <section className="json-card">
        <p className="section-title">JSON Output</p>
        <pre>{JSON.stringify(json, null, 2)}</pre>
      </section>
    </>
  );
}
