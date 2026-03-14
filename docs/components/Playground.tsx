'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import {
  Editor as InkioEditor,
  Viewer as InkioViewer,
  type DefaultExtensionsOptions as EditorDefaultExtensionsOptions,
  type InkioMessageOverrides,
  type TiptapEditor,
} from '@inkio/editor';
import { inkioIconRegistry, type InkioIconRegistry } from '@inkio/editor/icons';
import {
  Editor as SimpleEditor,
  Viewer as SimpleViewer,
  type DefaultExtensionsOptions as SimpleDefaultExtensionsOptions,
} from '@inkio/simple';
import {
  CommentPanel,
  type CommentMessage,
  type CommentThreadData,
} from '@inkio/advanced';
import { ImageEditorModal } from '@inkio/image-editor';
import '@inkio/editor/style.css';
import '@inkio/simple/minimal.css';
import '@inkio/image-editor/style.css';
import './Playground.css';

type PlaygroundMode = 'editor' | 'simple';

const SIMPLE_CONTENT = `<h2>Inkio Simple Playground</h2>
<p>Classic WYSIWYG preset for regular document editing.</p>
<ul>
  <li>Toolbar-first editing</li>
  <li>Headings, lists, tasks, links, code blocks</li>
  <li>Image uploads with optional image-editor integration</li>
</ul>`;

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

export default function Playground({ initialContent: initialContentProp }: { initialContent?: string } = {}) {
  const [mode, setMode] = useState<PlaygroundMode>('editor');
  const [content, setContent] = useState<any>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showJSON, setShowJSON] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
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

  const simpleDefaultExtensionsOptions = useMemo<SimpleDefaultExtensionsOptions>(
    () => ({
      placeholder: 'Write a document...',
      imageBlock: {
        onUpload: async (file: File) => URL.createObjectURL(file),
        imageEditor: ImageEditorModal,
      },
    }),
    [],
  );

  const editorDefaultExtensionsOptions = useMemo<EditorDefaultExtensionsOptions>(
    () => ({
      placeholder: 'Try /, #, [[page]], comments, and image editing...',
      locale,
      messages,
      icons: iconOverrides,
      hashtagItems: ({ query }: { query: string }) => {
        const tags = ['inkio', 'tiptap', 'editor', 'react', 'markdown', 'playground'];
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
        locale,
        messages,
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

  const defaultContent = mode === 'simple' ? SIMPLE_CONTENT : EDITOR_CONTENT;

  const handleModeChange = useCallback((newMode: PlaygroundMode) => {
    setMode(newMode);
    setContent(null);
    setEditorInstance(null);
    setCommentThreads([]);
    setEditorKey((current) => current + 1);
  }, []);

  return (
    <div className="inkio playground-root">
      <header className="playground-header">
        <div className="playground-header-left">
          <h1 className="playground-title">Inkio Playground</h1>
          <div className="playground-mode-switch">
            <button
              type="button"
              className={`playground-mode-btn${mode === 'simple' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              className={`playground-mode-btn${mode === 'editor' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('editor')}
            >
              Editor
            </button>
          </div>
        </div>
        <div className="playground-header-right">
          <label className="playground-toggle-label">
            <input
              type="checkbox"
              checked={showViewer}
              onChange={() => setShowViewer((value) => !value)}
              className="playground-toggle-input"
            />
            <span>Viewer</span>
          </label>
          <label className="playground-toggle-label">
            <input
              type="checkbox"
              checked={showJSON}
              onChange={() => setShowJSON((value) => !value)}
              className="playground-toggle-input"
            />
            <span>JSON</span>
          </label>
        </div>
      </header>

      <main className="playground-main">
        <section className="playground-section">
          <div className="playground-section-label">
            Editor
            <span className="playground-mode-badge">
              {mode === 'simple' ? '@inkio/simple' : '@inkio/editor'}
              {mode === 'editor' ? ' + direct CommentPanel + @inkio/image-editor' : ' + @inkio/image-editor'}
            </span>
          </div>
          <Suspense fallback={<div className="playground-loading">Loading editor...</div>}>
            {mode === 'simple' ? (
              <SimpleEditor
                key={editorKey}
                initialContent={initialContentProp ?? defaultContent}
                defaultExtensionsOptions={simpleDefaultExtensionsOptions}
                locale={locale}
                messages={messages}
                icons={iconOverrides}
                showToolbar
                onCreate={setEditorInstance}
                onUpdate={(next: unknown) => setContent(next)}
              />
            ) : (
              <InkioEditor
                key={editorKey}
                initialContent={initialContentProp ?? defaultContent}
                defaultExtensionsOptions={editorDefaultExtensionsOptions}
                locale={locale}
                messages={messages}
                icons={iconOverrides}
                showBubbleMenu
                showFloatingMenu
                onCreate={setEditorInstance}
                onUpdate={(next: unknown) => setContent(next)}
              />
            )}
          </Suspense>
        </section>

        {showViewer && content && (
          <section className="playground-section">
            <div className="playground-section-label">Viewer</div>
            {mode === 'simple' ? (
              <SimpleViewer content={content} defaultExtensionsOptions={simpleDefaultExtensionsOptions} />
            ) : (
              <InkioViewer content={content} defaultExtensionsOptions={editorDefaultExtensionsOptions} />
            )}
          </section>
        )}

        {showJSON && content && (
          <section className="playground-section">
            <div className="playground-section-label">JSON Output</div>
            <pre className="playground-json">{JSON.stringify(content, null, 2)}</pre>
          </section>
        )}

        {mode === 'editor' && (
          <section className="playground-section">
            <div className="playground-section-label">Comments</div>
            <CommentPanel
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
        )}
      </main>
    </div>
  );
}
