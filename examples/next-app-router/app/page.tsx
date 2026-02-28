import { EditorDemo } from '../components/editor-demo';

export default function Page() {
  return (
    <main className="page-shell">
      <section className="page-intro">
        <p className="eyebrow">Example</p>
        <h1>Next.js App Router + Inkio Extensions</h1>
        <p className="page-copy">
          Use this as the starting point when you want a client-side editor inside the App Router.
        </p>
        <ul className="feature-list">
          <li><code>/</code> slash commands</li>
          <li><code>#</code> hashtag suggestions</li>
          <li><code>[[page]]</code> wiki links</li>
          <li>drag-and-drop image upload</li>
        </ul>
      </section>
      <EditorDemo />
    </main>
  );
}
