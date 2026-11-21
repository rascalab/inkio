import { useState } from 'react';
import { Editor, type EditorProps } from '@inkio/simple';
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router';

const documents = [
  {
    id: 'field-notes',
    title: 'Field notes',
    content: '<h2>On the river trail</h2><p>The southern footbridge is open again. Add observations here before planning the next walk.</p>',
  },
  {
    id: 'packing-list',
    title: 'Packing list',
    content: '<h2>For the next walk</h2><ul><li>Water bottle</li><li>Paper map</li><li>Notebook and pencil</li></ul>',
  },
] as const;

type DocumentId = (typeof documents)[number]['id'];
type Draft = Parameters<NonNullable<EditorProps['onUpdate']>>[0];
type Drafts = Partial<Record<DocumentId, Draft>>;

const home = '/documents/field-notes';

function NotFound() {
  return (
    <section>
      <h1>Document not found</h1>
      <p>Choose a document from the navigation or <Link to={home}>open Field notes</Link>.</p>
    </section>
  );
}

function DocumentRoute({ drafts, saveDraft, readOnly = false }: {
  drafts: Drafts;
  saveDraft: (id: DocumentId, content: Draft) => void;
  readOnly?: boolean;
}) {
  const { documentId } = useParams<'documentId'>();
  const doc = documents.find(({ id }) => id === documentId);
  if (!doc) return <NotFound />;

  const editPath = `/documents/${doc.id}`;

  return (
    <section>
      <header className="document-header">
        <h1>{doc.title}</h1>
        <nav className="view-links" aria-label="Document mode">
          <NavLink to={editPath} end>Edit</NavLink>
          <NavLink to={`${editPath}/read`} end>Read</NavLink>
        </nav>
      </header>
      {/* Inkio takes initial content. Reset the editor instance when the document or mode changes. */}
      <Editor
        key={`${doc.id}:${readOnly ? 'read' : 'edit'}`}
        ariaLabel={`${doc.title} ${readOnly ? 'reader' : 'editor'}`}
        content={drafts[doc.id] ?? doc.content}
        editable={!readOnly}
        ui={{ showToolbar: !readOnly, toolbar: { placement: 'bottom' } }}
        onUpdate={readOnly ? undefined : (content) => saveDraft(doc.id, content)}
      />
    </section>
  );
}

export default function App() {
  // Keep drafts above Routes so navigation can unmount editors without losing their documents.
  const [drafts, setDrafts] = useState<Drafts>({});
  const saveDraft = (id: DocumentId, content: Draft) => {
    setDrafts((previous) => ({ ...previous, [id]: content }));
  };

  return (
    <main className="workspace">
      <aside className="workspace-sidebar">
        <p className="workspace-title">Inkio + React Router</p>
        <nav className="document-links" aria-label="Documents">
          {documents.map((doc) => (
            <NavLink key={doc.id} to={`/documents/${doc.id}`}>{doc.title}</NavLink>
          ))}
        </nav>
        <p className="draft-note">Drafts stay in memory as you navigate. Reloading resets them.</p>
      </aside>
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/documents/:documentId" element={<DocumentRoute drafts={drafts} saveDraft={saveDraft} />} />
        <Route path="/documents/:documentId/read" element={<DocumentRoute drafts={drafts} saveDraft={saveDraft} readOnly />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}
