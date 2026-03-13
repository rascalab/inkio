'use client';

import { useMemo, useState } from 'react';
import { Editor, getDefaultCoreExtensions } from '@inkio/editor';
import { BlockHandle } from '@inkio/extension/block-handle';
import { Callout } from '@inkio/extension/callout';
import { HashTag } from '@inkio/extension/hashtag';
import { SlashCommand } from '@inkio/extension/slash-command';
import { WikiLink } from '@inkio/extension/wikilink';

const initialContent = `<h2>Inkio in Next.js</h2>
<p>This example composes core extensions with only the extra features it needs.</p>
<ul>
  <li>Type <code>/</code> for slash commands</li>
  <li>Type <code>#</code> for hashtag suggestions</li>
  <li>Type <code>[[page]]</code> for wiki links</li>
  <li>Drop an image to test the upload stub</li>
</ul>`;

export function EditorDemo() {
  const [json, setJson] = useState<unknown>(null);

  const extensions = useMemo(
    () => [
      ...getDefaultCoreExtensions({
        placeholder: 'Type /, #, [[page]] and drop an image...',
        imageBlock: {
          onUpload: async (file: File) => URL.createObjectURL(file),
        },
      }),
      Callout,
      HashTag.configure({
        items: ({ query }: { query: string }) => {
          const tags = ['inkio', 'nextjs', 'tiptap', 'editor', 'ai'];
          return tags
            .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
            .map((tag) => ({ id: tag, label: `#${tag}` }));
        },
      }),
      SlashCommand,
      WikiLink.configure({
        onClick: (href: string) => {
          console.info('Navigate to wiki page:', href);
        },
      }),
      BlockHandle,
    ],
    [],
  );

  return (
    <>
      <section className="demo-card">
        <p className="section-title">Editor</p>
        <Editor
          extensions={extensions}
          initialContent={initialContent}
          showBubbleMenu
          showFloatingMenu
          onUpdate={(next: unknown) => setJson(next)}
        />
      </section>

      <section className="json-card">
        <p className="section-title">JSON Output</p>
        <pre>{JSON.stringify(json, null, 2)}</pre>
      </section>
    </>
  );
}
