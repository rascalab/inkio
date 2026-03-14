'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Editor,
  type InkioMessageOverrides,
  type TiptapEditor,
} from '@inkio/editor';
import { inkioIconRegistry, type InkioIconRegistry } from '@inkio/editor/icons';
import {
  CommentPanel,
  type CommentMessage,
  type CommentThreadData,
} from '@inkio/advanced';
import { ImageEditorModal } from '@inkio/image-editor';

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

export function EditorDemo() {
  const [json, setJson] = useState<unknown>(null);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [commentThreads, setCommentThreads] = useState<CommentThreadData[]>([]);
  const commentThreadsRef = useRef<CommentThreadData[]>([]);
  commentThreadsRef.current = commentThreads;

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

  const defaultExtensionsOptions = useMemo(
    () => ({
      placeholder: 'Type /, #, [[page]] and select text for comments...',
      locale,
      messages,
      icons: iconOverrides,
      hashtagItems: ({ query }: { query: string }) => {
        const tags = ['inkio', 'nextjs', 'tiptap', 'editor', 'ai'];
        return tags
          .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
          .map((tag) => ({ id: tag, label: `#${tag}` }));
      },
      imageBlock: {
        onUpload: async (file: File) => URL.createObjectURL(file),
        imageEditor: ImageEditorModal,
      },
      comment: {
        icons: iconOverrides,
        currentUser: 'You',
        onCommentSubmit: (threadId: string, text: string) => {
          const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
          setCommentThreads((prev) => [...prev, { id: threadId, messages: [message], resolved: false }]);
        },
        getThread: (threadId: string) =>
          commentThreadsRef.current.find((thread) => thread.id === threadId) ?? null,
        onCommentReply: handleReply,
        onCommentResolve: handleResolve,
        onCommentDelete: handleDelete,
      },
    }),
    [handleDelete, handleReply, handleResolve, iconOverrides, locale, messages],
  );

  return (
    <>
      <section className="demo-card">
        <p className="section-title">Editor</p>
        <Editor
          defaultExtensionsOptions={defaultExtensionsOptions}
          initialContent={initialContent}
          showToolbar
          showBubbleMenu
          showFloatingMenu
          icons={iconOverrides}
          messages={messages}
          locale={locale}
          onCreate={setEditorInstance}
          onUpdate={(next: unknown) => setJson(next)}
        />
      </section>

      <section className="demo-card">
        <p className="section-title">Comments (@inkio/advanced)</p>
        <CommentPanel
          editor={editorInstance}
          threads={commentThreads}
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
