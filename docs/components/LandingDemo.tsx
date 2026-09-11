'use client';

import { useMemo } from 'react';
import { Editor } from '@inkio/editor';
import '@inkio/editor/style.css';
import './landing.css';

const DEMO_DOC = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '페이지를 떠나지 마세요. 여기서 바로 써보세요.' }],
    },
    {
      type: 'callout',
      attrs: { color: 'blue', icon: null },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '이 에디터가 살아 있습니다. 텍스트를 고치고, / 를 눌러 슬래시 메뉴를 열어 보세요.' }],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'npm install @inkio/editor' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '붙여넣고 바로 쓰기' }] }],
        },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'tsx' },
      content: [
        {
          type: 'text',
          text: "import { Editor } from '@inkio/editor';\n\n<Editor initialContent=\"<p>Hello Inkio</p>\" />",
        },
      ],
    },
  ],
};

/**
 * Landing hero live demo: a real editor instance (dark) so visitors feel
 * the product in seconds. Read-only chrome only — no persistence.
 */
export default function LandingDemo() {
  const content = useMemo(() => DEMO_DOC, []);
  return (
    <div className="inkio-landing-demo dark">
      <div className="inkio-landing-demo-bar" aria-hidden="true">
        <span className="inkio-landing-demo-dot" />
        <span className="inkio-landing-demo-dot" />
        <span className="inkio-landing-demo-dot" />
        <span className="inkio-landing-demo-title">demo.tsx — live</span>
      </div>
      <Editor initialContent={content as never} theme="dark" />
    </div>
  );
}
