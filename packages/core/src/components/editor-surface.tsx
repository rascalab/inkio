'use client';

import { EditorContent, type Extensions, type JSONContent } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { useResolvedInkioEditor } from '../hooks/use-resolved-inkio-editor';
import { setEditorUi, type EditorUi } from '../context/editor-ui';
import { useInkioContext } from '../context/InkioProvider';
import { resolveCoreMessages, toCoreMessageOverrides } from '../i18n/messages';
import { isEqualStaticContent } from '../utils/static-content';
import {
  createEditorPlaceholderHtml,
  renderInkioStaticContent,
  type StaticContentRenderResult,
} from '../ssr/render-static-content';
import type { EditorProps } from './Editor';

export function EditorContainer({ style, theme, fill, autoresize, bordered = true, className, children }: Pick<EditorProps, 'style' | 'theme' | 'fill' | 'autoresize' | 'bordered' | 'className'> & { children: React.ReactNode }) {
  return (
    <div
      style={style}
      className={`inkio inkio-editor${theme ? ` ${theme}` : ''}${fill ? ' inkio-editor--fill' : ''}${!fill && autoresize ? ' inkio-editor--autoresize' : ''}${bordered ? ' inkio-container-default' : ''}${className ? ` ${className}` : ''}`}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}

/** Shared SSR shell, node views and live UI updates for editable and read-only surfaces. */
export function useEditorSurface({ content, placeholder, ariaLabel, editable = true, onChange, onUpdate, onCreate, locale, messages, icons }: EditorProps, resolvedExtensions: Extensions) {
  const context = useInkioContext();
  const uiLocale = locale ?? context.locale;
  const uiMessages = messages ?? context.messages;
  const uiIcons = icons ?? context.icons;
  const editorLabel = useMemo(
    () => ariaLabel?.trim() || resolveCoreMessages(uiLocale, toCoreMessageOverrides(uiMessages)).editor.label,
    [ariaLabel, uiLocale, uiMessages],
  );

  const editor = useResolvedInkioEditor({
    content,
    // Reuse the already-resolved extensions so static SSR HTML and the live
    // editor share a single schema instance.
    extensions: resolvedExtensions,
    placeholder,
    ariaLabel: editorLabel,
    editable,
    onChange,
    onUpdate,
    onCreate,
  });
  // A prop this editor was never given leaves what its extensions were configured with.
  const givenUi = useRef<EditorUi>({});
  useEffect(() => {
    if (!editor) return;
    const current: EditorUi = { locale: uiLocale, messages: uiMessages, icons: uiIcons, placeholder };
    const given = givenUi.current as Record<string, unknown>;
    for (const [key, value] of Object.entries(current)) {
      if (value !== undefined || key in given) given[key] = value;
    }
    setEditorUi(editor, givenUi.current);
  }, [editor, uiLocale, uiMessages, uiIcons, placeholder]);

  // `immediatelyRender: false` keeps `editor` null through SSR and the
  // hydration render (it is created in a mount effect), so a non-null editor
  // already implies the client has hydrated.
  const showInteractiveRuntime = !!editor;
  // Static SSR shell: never recompute generateHTML + sanitize when content is
  // unchanged. useMemo alone keys on object identity, so an inline JSON
  // literal from a re-rendering parent would redo the expensive render every
  // time — the ref cache below skips it on identity OR deep equality. Once
  // the live editor is mounted the shell is not rendered, so skip it
  // entirely (controlled `content` would otherwise pay this per keystroke).
  const staticCacheRef = useRef<{
    content: string | JSONContent | undefined;
    extensions: Extensions;
    result: StaticContentRenderResult;
  } | null>(null);
  let staticHtml = '';
  if (!showInteractiveRuntime) {
    const cached = staticCacheRef.current;
    let staticRender: StaticContentRenderResult;
    if (
      cached
      && cached.extensions === resolvedExtensions
      && isEqualStaticContent(cached.content, content)
    ) {
      staticRender = cached.result;
    } else {
      try {
        staticRender = renderInkioStaticContent(content, resolvedExtensions);
      } catch (error) {
        // Out-of-schema content must degrade to the shell, never throw out
        // of render (SSR crash / blank client tree).
        console.warn('[inkio] static render failed, showing shell instead:', error);
        staticRender = {
          json: { type: 'doc', content: [{ type: 'paragraph' }] },
          html: '',
          headings: [],
          shellOnly: true,
        };
      }
      staticCacheRef.current = {
        content,
        extensions: resolvedExtensions,
        result: staticRender,
      };
    }
    staticHtml = staticRender.html || (editable ? createEditorPlaceholderHtml(placeholder) : '<p></p>');
  }
  const body = editor ? (
    <EditorContent className="inkio-editor-body" editor={editor} />
  ) : (
    <div className="inkio-editor-body">
      <div className="tiptap ProseMirror inkio-content" dangerouslySetInnerHTML={{ __html: staticHtml }} />
    </div>
  );
  return { editor, body };
}
