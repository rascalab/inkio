import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { Editor, ToC, read, type InkioEditor } from '../index';

it('uses the displayed preset reference labels in saved and live headings, references and ToC links', async () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  try {
    const content = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
      { type: 'heading', attrs: { level: 2 }, content: [
        { type: 'mention', attrs: { id: 'u1', label: '' }, content: [] },
        { type: 'hardBreak' },
        { type: 'hashTag', attrs: { id: 'inkio' }, content: [] },
        { type: 'text', text: ' ' },
        { type: 'wikiLink', attrs: { href: 'Home' }, content: [] },
      ] },
    ] };
    const onCreate = vi.fn<(editor: InkioEditor) => void>();
    render(<Editor content={content} blockHandle={false} onCreate={onCreate} />);
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    const editor = onCreate.mock.calls[0][0];
    const heading = editor.view.dom.querySelector('h2')!;
    expect(heading.querySelector('[data-mention]')).toHaveTextContent('@u1');
    expect(heading.querySelector('[data-hashtag]')).toHaveTextContent('#inkio');
    expect(heading.querySelector('[data-wiki-link]')).toHaveTextContent('Home');
    for (const doc of [read(content), editor, read(editor.getJSON())]) {
      expect(doc.mentions).toEqual([{ id: 'u1', label: 'u1' }]);
      expect(doc.hashTags).toEqual(['inkio']);
      expect(doc.headings).toEqual([{ text: '@u1 #inkio Home', level: 2, index: 0, id: 'u1-inkio-home' }]);
      expect(doc.text).toContain('@u1\n#inkio Home');
    }
    const toc = render(<ToC source={editor} />);
    expect(toc.getByRole('link', { name: '@u1 #inkio Home' })).toHaveAttribute('href', '#u1-inkio-home');

    // Later steps use positions in the document produced by the preceding step.
    const mentionPos = editor.state.doc.firstChild!.nodeSize + 1;
    act(() => {
      const tr = editor.state.tr.insertText('additional body text', 2);
      tr.setNodeAttribute(tr.mapping.map(mentionPos), 'label', 'Grace');
      editor.view.dispatch(tr);
    });
    expect(heading.querySelector('[data-mention]')).toHaveTextContent('@Grace');
    expect(editor.headings[0].text).toBe('@Grace #inkio Home');
    expect(toc.getByRole('link', { name: '@Grace #inkio Home' })).toHaveAttribute('href', '#grace-inkio-home');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps rejected wiki targets out of editable text, attributes and click callbacks on mount and update', async () => {
  const content = { type: 'doc', content: [{ type: 'heading', content: [
    { type: 'wikiLink', attrs: { href: 'urn:example:one' } },
  ] }] };
  const onCreate = vi.fn<(editor: InkioEditor) => void>();
  const onClick = vi.fn();
  render(<Editor content={content} onWikiLinkClick={onClick} blockHandle={false} onCreate={onCreate} />);
  await waitFor(() => expect(onCreate).toHaveBeenCalled());
  const editor = onCreate.mock.calls[0][0];
  const wiki = () => editor.view.dom.querySelector<HTMLElement>('[data-wiki-link]')!;
  const assertHidden = () => {
    expect(wiki().textContent).toBe('');
    expect(wiki()).not.toHaveAttribute('href');
    expect(editor.getHTML()).not.toContain('urn:');
    expect(editor.text).toBe('');
    expect(editor.headings[0].text).toBe('');
    fireEvent.click(wiki());
  };
  assertHidden();
  expect(onClick).not.toHaveBeenCalled();
  act(() => { editor.view.dispatch(editor.state.tr.setNodeAttribute(1, 'href', 'Project Page')); });
  expect(wiki().textContent).toBe('Project Page');
  expect(wiki()).toHaveAttribute('href', 'Project Page');
  fireEvent.click(wiki());
  expect(onClick).toHaveBeenCalledWith('Project Page');
  act(() => { editor.view.dispatch(editor.state.tr.setNodeAttribute(1, 'href', 'urn:example:two')); });
  assertHidden();
  expect(onClick).toHaveBeenCalledTimes(1);
});
