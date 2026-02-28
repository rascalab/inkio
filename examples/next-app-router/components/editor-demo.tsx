'use client';

import { useMemo, useState } from 'react';
import { Editor } from '@inkio/editor';
import { getDefaultInkioExtensions } from '@inkio/extension';

const initialContent = `<h2>Inkio in Next.js</h2>
<p>This example uses <code>@inkio/editor</code> and <code>@inkio/extension</code> together.</p>
<ul>
  <li>Type <code>/</code> for slash commands</li>
  <li>Type <code>#</code> for hashtag suggestions</li>
  <li>Type <code>[[page]]</code> for wiki links</li>
  <li>Drop an image to test the upload stub</li>
</ul>`;

export function EditorDemo() {
  const [json, setJson] = useState<unknown>(null);

  const extensions = useMemo(
    () =>
      getDefaultInkioExtensions({
        placeholder: 'Type /, #, [[page]] and drop an image...',
        blockHandle: true,
        hashtagItems: ({ query }: { query: string }) => {
          const tags = ['inkio', 'nextjs', 'tiptap', 'editor', 'ai'];
          return tags
            .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
            .map((tag) => ({ id: tag, label: `#${tag}` }));
        },
        onWikiLinkClick: (href: string) => {
          console.info('Navigate to wiki page:', href);
        },
        onUpload: async (file: File) => URL.createObjectURL(file),
      }),
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
