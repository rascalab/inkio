'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Editor as InkioEditor,
  Viewer as InkioViewer,
  ToC,
  type InkioMessageOverrides,
  type TiptapEditor,
  type CommentConfig,
} from '@inkio/editor';
import { inkioIconRegistry, type InkioIconRegistry } from '@inkio/editor/icons';
import {
  type CommentPanelProps,
  type CommentMessage,
  type CommentData,
} from '@inkio/advanced';
import type { ImageEditorModalProps } from '@inkio/image-editor';
import { PLAYGROUND_INITIAL_CONTENT } from './playground-content';
import { useDebouncedState } from './use-debounced-state';
import { useObjectUrlRegistry } from './use-object-urls';

const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);

const LazyCommentPanel = dynamic<CommentPanelProps>(
  () => import('@inkio/advanced').then((mod) => mod.CommentPanel),
  { loading: () => <div className="playground-loading">Loading comments...</div> },
);

let fallbackIdCounter = 0;

function createId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // Monotonic counter suffix: Date.now() alone collides under rapid
  // comment creation and Math.random() is not unique.
  fallbackIdCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
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
  const { resolvedTheme } = useTheme();
  // resolvedTheme is undefined pre-hydration: defaulting to light flashes
  // the editor theme, so hold the pane until the theme resolves.
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    if (resolvedTheme) setThemeReady(true);
  }, [resolvedTheme]);
  const inkioTheme = resolvedTheme === 'dark' ? 'dark' : 'light' as const;

  if (!themeReady) {
    return <div className="playground-loading">Loading playground...</div>;
  }
  const [content, handleUpdate] = useDebouncedState<unknown>(
    initialContent ?? PLAYGROUND_INITIAL_CONTENT,
  );
  const createObjectUrl = useObjectUrlRegistry();
  const handleImageUpload = useCallback(
    async (file: File) => createObjectUrl(file),
    [createObjectUrl],
  );
  const hashtagItems = useCallback(({ query }: { query: string }) => {
    const tags = ['inkio', 'tiptap', 'editor', 'react', 'markdown', 'playground'];
    return tags
      .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      .map((tag) => ({ id: tag, label: `#${tag}` }));
  }, []);
  const imageBlock = useMemo(() => ({ imageEditor: LazyImageEditorModal }), []);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [viewerInstance, setViewerInstance] = useState<TiptapEditor | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const commentsRef = useRef<CommentData[]>([]);
  commentsRef.current = comments;

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
      <section className="playground-section">
        <div className="playground-section-label">
          Editor
          <span className="playground-mode-badge">
            @inkio/editor + lazy comments + lazy @inkio/image-editor
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <InkioEditor
            initialContent={initialContent ?? PLAYGROUND_INITIAL_CONTENT}
            placeholder="Try /, #, [[page]], comments, and image editing..."
            theme={inkioTheme}
            locale={locale}
            ui={{
              autoresize: true,
              showBubbleMenu: true,
              showFloatingMenu: true,
              messages,
              icons: iconOverrides,
            }}
            hashtagItems={hashtagItems}
            onImageUpload={handleImageUpload}
            imageBlock={imageBlock}
            comment={comment}
            onCreate={setEditorInstance}
            onUpdate={handleUpdate}
          />
          <ToC source={editorInstance} />
        </div>
      </section>

      {showViewer && content && (
        <section className="playground-section">
          <div className="playground-section-label">Viewer</div>
          <div style={{ position: 'relative' }}>
            <InkioViewer content={content} theme={inkioTheme} onCreate={setViewerInstance} />
            <ToC source={viewerInstance} />
          </div>
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
          threads={comments}
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
