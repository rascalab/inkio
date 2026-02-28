'use client';

import { useState, useCallback, useRef, useMemo, Suspense } from 'react';
import {
  Editor,
  Viewer,
  getDefaultCoreExtensions,
  inkioIconRegistry,
  type InkioIconRegistry,
  type InkioMessageOverrides,
} from '@inkio/editor';
import {
  CommentPanel,
  getDefaultInkioExtensions,
  type CommentMessage,
  type CommentThreadData,
} from '@inkio/extension';
import type { Editor as TiptapEditor } from '@tiptap/react';
import '@inkio/editor/style.css';
import '@inkio/extension/style.css';
import './Playground.css';

type PlaygroundMode = 'full' | 'core';

const CORE_CONTENT = `<h2>Inkio Core Playground</h2>
<p>기본 에디터를 체험해보세요. <code>@inkio/editor</code> 패키지만 사용합니다.</p>
<ul>
  <li><strong>Bold</strong>, <em>Italic</em>, <u>Underline</u>, <s>Strikethrough</s></li>
  <li><code>Inline code</code> and <mark>Highlight</mark></li>
  <li>Task list, ordered/unordered lists</li>
</ul>
<blockquote><p>Tip: 확장 기능(슬래시 커맨드, 멘션, 해시태그 등)은 "Full" 모드에서 사용할 수 있습니다.</p></blockquote>`;

const FULL_CONTENT = `<h2>Inkio Playground</h2>
<p>리치 텍스트 에디터를 직접 체험해보세요.</p>
<ul>
  <li><strong>Bold</strong>, <em>Italic</em>, <u>Underline</u>, <s>Strikethrough</s></li>
  <li><code>Inline code</code> and <mark>Highlight</mark></li>
  <li>Task list, ordered/unordered lists</li>
</ul>
<p>Try these features:</p>
<ul>
  <li><code>/</code> for slash commands</li>
  <li><code>@</code> for mentions</li>
  <li><code>#</code> for hashtags</li>
  <li><code>::info </code> for callout blocks</li>
  <li><code>[[page]]</code> for wiki links</li>
  <li>Select text and press <code>Ctrl+Cmd+M</code> to add a comment</li>
  <li>Drag &amp; drop an image to test the image editor</li>
</ul>
<blockquote><p>Tip: Use the theme toggle in the navbar to switch between light and dark mode.</p></blockquote>`;

function createId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Playground({ initialContent: initialContentProp }: { initialContent?: string } = {}) {
  const [mode, setMode] = useState<PlaygroundMode>('full');
  const [content, setContent] = useState<any>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showJSON, setShowJSON] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [commentThreads, setCommentThreads] = useState<CommentThreadData[]>([]);
  const commentThreadsRef = useRef<CommentThreadData[]>([]);
  commentThreadsRef.current = commentThreads;
  const localeInput = 'en-US,en;q=0.9';
  const [editorKey, setEditorKey] = useState(0);
  const [tabBehavior, setTabBehavior] = useState<'indent' | 'default'>('indent');

  const iconOverrides = useMemo<Partial<InkioIconRegistry>>(
    () => ({ comment: inkioIconRegistry.comment }),
    [],
  );

  const messageOverrides = useMemo<InkioMessageOverrides>(
    () => ({
      core: {
        suggestion: {
          empty: 'No matching items.',
        },
      },
      extensions: {
        commentComposer: {
          placeholder: 'Share feedback...',
        },
      },
    }),
    [],
  );

  const handleReply = useCallback((commentId: string, text: string) => {
    const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
    setCommentThreads((prev) => prev.map((thread) => {
      if (thread.id !== commentId) return thread;
      return { ...thread, messages: [...thread.messages, message] };
    }));
  }, []);

  const handleResolve = useCallback((commentId: string) => {
    setCommentThreads((prev) => prev.map((thread) => {
      if (thread.id !== commentId) return thread;
      return { ...thread, resolved: true };
    }));
  }, []);

  const handleDelete = useCallback((commentId: string) => {
    setCommentThreads((prev) => prev.filter((thread) => thread.id !== commentId));
  }, []);

  const coreExtensions = useMemo(
    () => getDefaultCoreExtensions({ placeholder: 'Start typing...', tabBehavior }),
    [tabBehavior],
  );

  const fullExtensions = useMemo(
    () =>
      getDefaultInkioExtensions({
        placeholder: 'Start typing... try /, @, # and image upload',
        blockHandle: true,
        tabBehavior,
        locale: localeInput,
        messages: messageOverrides,
        icons: iconOverrides,
        hashtagItems: ({ query }: { query: string }) => {
          const tags = ['inkio', 'tiptap', 'editor', 'react', 'prosemirror', 'markdown', 'playground'];
          return tags
            .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
            .map((tag) => ({ id: tag, label: `#${tag}` }));
        },
        comment: {
          onCommentCreate: (_threadId: string, _selection: string) => {},
          onCommentSubmit: (threadId: string, text: string, _selection: string) => {
            const message: CommentMessage = { id: createId(), author: 'You', text, createdAt: new Date() };
            setCommentThreads((prev) => [...prev, { id: threadId, messages: [message], resolved: false }]);
          },
          getThread: (threadId: string) => commentThreadsRef.current.find((t) => t.id === threadId) ?? null,
          onCommentReply: handleReply,
          onCommentResolve: handleResolve,
          onCommentDelete: handleDelete,
          currentUser: 'You',
        },
      }),
    [iconOverrides, localeInput, messageOverrides, handleReply, handleResolve, handleDelete, tabBehavior],
  );

  const extensions = mode === 'core' ? coreExtensions : fullExtensions;
  const defaultContent = mode === 'core' ? CORE_CONTENT : FULL_CONTENT;

  const handleModeChange = useCallback((newMode: PlaygroundMode) => {
    setMode(newMode);
    setContent(null);
    setEditorInstance(null);
    setCommentThreads([]);
    setEditorKey((k) => k + 1);
  }, []);

  const handleUpdate = useCallback((json: any) => {
    setContent(json);
  }, []);

  return (
    <div ref={rootRef} className="inkio playground-root">
      {/* Header */}
      <header className="playground-header">
        <div className="playground-header-left">
          <h1 className="playground-title">Inkio Playground</h1>
          <div className="playground-mode-switch">
            <button
              type="button"
              className={`playground-mode-btn${mode === 'core' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('core')}
            >
              Core
            </button>
            <button
              type="button"
              className={`playground-mode-btn${mode === 'full' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('full')}
            >
              Full
            </button>
          </div>
        </div>
        <div className="playground-header-right">
          <div className="playground-mode-switch">
            <button
              type="button"
              className={`playground-mode-btn${tabBehavior === 'indent' ? ' is-active' : ''}`}
              onClick={() => { setTabBehavior('indent'); setEditorKey((k) => k + 1); }}
            >
              Tab: Indent
            </button>
            <button
              type="button"
              className={`playground-mode-btn${tabBehavior === 'default' ? ' is-active' : ''}`}
              onClick={() => { setTabBehavior('default'); setEditorKey((k) => k + 1); }}
            >
              Tab: Default
            </button>
          </div>
          <label className="playground-toggle-label">
            <input
              type="checkbox"
              checked={showViewer}
              onChange={() => setShowViewer((v) => !v)}
              className="playground-toggle-input"
            />
            <span>Viewer</span>
          </label>
          <label className="playground-toggle-label">
            <input
              type="checkbox"
              checked={showJSON}
              onChange={() => setShowJSON((v) => !v)}
              className="playground-toggle-input"
            />
            <span>JSON</span>
          </label>
        </div>
      </header>

      {/* Editor */}
      <main className="playground-main">
        <section className="playground-section">
          <div className="playground-section-label">
            Editor
            <span className="playground-mode-badge">
              {mode === 'core' ? '@inkio/editor' : '@inkio/editor + @inkio/extension'}
            </span>
          </div>
          <Suspense
            fallback={
              <div className="playground-loading">Loading editor...</div>
            }
          >
            <Editor
              key={editorKey}
              extensions={extensions}
              initialContent={initialContentProp ?? defaultContent}
              locale={localeInput}
              messages={messageOverrides}
              icons={iconOverrides}
              showBubbleMenu
              showFloatingMenu={true}
              onCreate={setEditorInstance}
              onUpdate={handleUpdate}
            />
          </Suspense>
        </section>

        {/* Viewer */}
        {showViewer && content && (
          <section className="playground-section">
            <div className="playground-section-label">Viewer (read-only)</div>
            <Viewer extensions={extensions} content={content} />
          </section>
        )}

        {/* JSON Output */}
        {showJSON && content && (
          <section className="playground-section">
            <div className="playground-section-label">JSON Output</div>
            <pre className="playground-json">
              {JSON.stringify(content, null, 2)}
            </pre>
          </section>
        )}
        {/* Comments (full mode only) */}
        {mode === 'full' && (
          <section className="playground-section">
            <div className="playground-section-label">Comments</div>
            <CommentPanel
              editor={editorInstance}
              threads={commentThreads}
              locale={localeInput}
              messages={messageOverrides}
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
