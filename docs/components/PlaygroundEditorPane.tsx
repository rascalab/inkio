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
import { createId, type InkioJSONContent } from '@inkio/core';
import {
  type CommentPanelProps,
  type CommentMessage,
  type CommentData,
} from '@inkio/advanced';
import { PLAYGROUND_INITIAL_CONTENT, type PlaygroundLocale } from './playground-content';
import PlaygroundJson from './PlaygroundJson';
import { usePlaygroundDocument } from './use-playground-document';
import { useObjectUrlRegistry } from './use-object-urls';
import { LazyImageEditorModal } from './lazy-image-editor-modal';

const LazyCommentPanel = dynamic<CommentPanelProps>(
  () => import('@inkio/advanced').then((mod) => mod.CommentPanel),
  { loading: () => <div className="playground-loading">Loading comments...</div> },
);

const PLAYGROUND_PAGES = [
  'Getting Started',
  'Components',
  'Extensions',
  'Collaboration',
  'Image Editor',
  'Serialization',
  'SSR',
  'Troubleshooting',
];

type PlaygroundEditorPaneProps = {
  content?: string;
  locale: PlaygroundLocale;
  active: boolean;
  showViewer: boolean;
  showJSON: boolean;
};

export default function PlaygroundEditorPane({
  content: initialDoc,
  locale,
  active,
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

  const initialContent = initialDoc ?? PLAYGROUND_INITIAL_CONTENT;
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
  const wikiLinkItems = useCallback(({ query }: { query: string }) => {
    return PLAYGROUND_PAGES
      .filter((page) => page.toLowerCase().includes(query.toLowerCase()))
      .map((page) => ({ id: page, label: page }));
  }, []);
  const [wikiLinkTarget, setWikiLinkTarget] = useState<string | null>(null);
  const imageBlock = useMemo(() => ({ imageEditor: LazyImageEditorModal }), []);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const doc = usePlaygroundDocument(editorInstance, active && (showViewer || showJSON));
  const [comments, setComments] = useState<CommentData[]>([]);
  const commentsRef = useRef<CommentData[]>([]);
  commentsRef.current = comments;

  const iconOverrides = useMemo<Partial<InkioIconRegistry>>(
    () => ({ comment: inkioIconRegistry.comment }),
    [],
  );
  const messages = useMemo<InkioMessageOverrides>(
    () => ({
      core: {
        suggestion: { empty: locale === 'ko' ? '맞는 항목이 없어요.' : 'No matching items.' },
      },
      extensions: {
        commentComposer: { placeholder: locale === 'ko' ? '의견을 남겨 보세요...' : 'Share feedback...' },
      },
    }),
    [locale],
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

  // Below every Hook call by design: returning earlier would change the
  // hook count once themeReady flips and crash with a hook-order error.
  if (!themeReady) {
    return <div className="playground-loading">Loading playground...</div>;
  }

  return (
    <>
      <section className="playground-section">
        <div className="playground-section-heading">
          <h2 className="playground-section-label">Editor</h2>
          <span className="playground-mode-badge">
            @inkio/editor + lazy comments + lazy @inkio/image-editor
          </span>
        </div>
        <div className="playground-editor-frame">
          <InkioEditor
            content={initialContent}
            placeholder={
              locale === 'ko'
                ? '/, #, [[, 댓글, 이미지 편집을 써 보세요...'
                : 'Try /, #, [[, comments, and image editing...'
            }
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
            wikiLinkItems={wikiLinkItems}
            onWikiLinkClick={setWikiLinkTarget}
            onImageUpload={handleImageUpload}
            imageBlock={imageBlock}
            comment={comment}
            onCreate={setEditorInstance}
          />
          {active && <ToC source={editorInstance} />}
        </div>
        {wikiLinkTarget && (
          <div className="playground-note" role="status">
            Wiki link clicked: <strong>{wikiLinkTarget}</strong>. An app would navigate to this page.
          </div>
        )}
      </section>

      {active && showViewer && (
        <PlaygroundViewer content={doc ?? initialContent} locale={locale} theme={inkioTheme} />
      )}

      {active && showJSON && <PlaygroundJson content={doc} />}

      <section className="playground-section">
        <h2 className="playground-section-label">Comments</h2>
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

function PlaygroundViewer({ content, locale, theme }: {
  content: string | InkioJSONContent;
  locale: PlaygroundLocale;
  theme: 'dark' | 'light';
}) {
  const [viewerInstance, setViewerInstance] = useState<TiptapEditor | null>(null);

  return (
    <section className="playground-section">
      <h2 className="playground-section-label">Viewer</h2>
      <div className="playground-editor-frame">
        <InkioViewer content={content} locale={locale} theme={theme} onCreate={setViewerInstance} />
        <ToC source={viewerInstance} />
      </div>
    </section>
  );
}
