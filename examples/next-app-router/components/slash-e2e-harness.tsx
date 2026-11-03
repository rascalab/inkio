'use client';

import { Editor } from '@inkio/editor';

export function SlashE2EHarness() {
  return (
    <main className="page-shell">
      <section className="demo-card">
        <Editor content="<p>슬래시 시험</p>" locale="ko" />
      </section>
    </main>
  );
}
