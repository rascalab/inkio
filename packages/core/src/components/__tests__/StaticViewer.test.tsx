import { render } from '@testing-library/react';
import { Node, type JSONContent } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { renderToString } from 'react-dom/server';
import { getExtensions } from '../../extensions/get-extensions';
import { StaticViewer } from '../../static';
import { Viewer } from '../Viewer';

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const customBlock = Node.create({
  name: 'customBlock',
  group: 'block',
  content: 'text*',
  renderHTML() {
    return ['p', { class: 'custom-block', onclick: 'return false' }, 0];
  },
});

describe('StaticViewer', () => {
  it('renders content as static HTML without an editor chrome', () => {
    const { container } = render(
      <StaticViewer
        content={{
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Hello static' }],
            },
            {
              type: 'codeBlock',
              attrs: { language: 'typescript' },
              content: [{ type: 'text', text: 'const x = 1;' }],
            },
          ],
        }}
      />,
    );

    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
    expect(container.querySelector('h2')?.textContent).toBe('Hello static');
    expect(container.querySelector('pre code')?.textContent).toBe('const x = 1;');
    // No interactive editor runtime: no toolbar, no editable surface.
    expect(container.querySelector('.inkio-toolbar')).not.toBeInTheDocument();
    expect(container.querySelector('[contenteditable="true"]')).not.toBeInTheDocument();
  });

  it('renders the editor schema without node views and sanitizes the result', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Shared heading' }] },
        { type: 'tocBlock', attrs: { maxLevel: 2 } },
        {
          type: 'taskList',
          content: [{
            type: 'taskItem',
            attrs: { checked: true },
            content: [paragraph('Completed task')],
          }],
        },
        { type: 'callout', attrs: { color: 'blue', icon: '!' }, content: [paragraph('Note')] },
        {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Summary' }] },
            { type: 'detailsContent', content: [paragraph('Toggle body')] },
          ],
        },
        { type: 'imageBlock', attrs: { src: '/example.png', alt: 'Example', caption: 'Caption' } },
        {
          type: 'table',
          content: [{
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [paragraph('Header')] },
              { type: 'tableCell', content: [paragraph('Cell')] },
            ],
          }],
        },
        { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'let x = 1;' }] },
        { type: 'customBlock', content: [{ type: 'text', text: 'Custom rendering' }] },
      ],
    };
    const { container } = render(
      <>
        <StaticViewer content={content} extensions={[customBlock]} theme="dark" ui={{ className: 'preview', bordered: false, style: { opacity: 0.5 } }} />
        <Viewer content={content} extensions={{ items: [...getExtensions(), customBlock], replace: true }} />
      </>,
    );
    const [staticContent, editorContent] = container.querySelectorAll('.inkio-content');
    expect(staticContent.innerHTML).toBe(editorContent.innerHTML);
    const query = (selector: string) => staticContent.querySelector(selector);
    expect(query('h2#shared-heading')).toHaveTextContent('Shared heading');
    expect(query('[data-type="toc"]')).toHaveTextContent('Table of contents');
    expect(query('ul[data-type="taskList"] input[checked]')).toBeDisabled();
    expect(query('.inkio-callout')).toHaveTextContent('Note');
    expect(query('details > summary')).toHaveTextContent('Summary');
    expect(query('details')).toHaveTextContent('Toggle body');
    expect(query('figure[data-type="imageBlock"] img')).toHaveAttribute('src', '/example.png');
    expect(query('figure figcaption')).toHaveTextContent('Caption');
    expect(query('table th')).toHaveTextContent('Header');
    expect(query('table td')).toHaveTextContent('Cell');
    expect(query('pre code.language-typescript')).toHaveTextContent('let x = 1;');
    expect(query('.custom-block')).toHaveTextContent('Custom rendering');
    expect(query('.custom-block')).not.toHaveAttribute('onclick');
    expect(staticContent.parentElement).toHaveClass('inkio-viewer', 'dark', 'preview');
    expect(staticContent.parentElement).not.toHaveClass('inkio-container-default');
    expect(staticContent.parentElement).toHaveStyle({ opacity: '0.5' });
  });

  it('adds custom nodes to the core Viewer schema', () => {
    const content = { type: 'doc', content: [paragraph('Default paragraph'), { type: 'customBlock' }] };
    const { container } = render(<Viewer content={content} extensions={[customBlock]} />);
    expect(container.querySelector('p')).toHaveTextContent('Default paragraph');
    expect(container.querySelector('.custom-block')).toBeInTheDocument();
  });

  it('can replace the default extensions and still sanitizes HTML input', () => {
    const extensions = { items: [Document.extend({ content: 'customBlock+' }), Text, customBlock], replace: true };
    const { container, rerender } = render(
      <StaticViewer
        extensions={extensions}
        content={{ type: 'doc', content: [{ type: 'customBlock', content: [{ type: 'text', text: 'Custom only' }] }] }}
      />,
    );
    expect(container.querySelector('.custom-block')).toHaveTextContent('Custom only');
    rerender(<StaticViewer extensions={extensions} content="<h3>Safe heading</h3><p onclick='return false'>Safe text</p><script>discard me</script><input type='text'>" />);
    expect(container.querySelector('h3#safe-heading')).toBeInTheDocument();
    expect(container.querySelector('p')).toHaveTextContent('Safe text');
    expect(container.querySelector('p')).not.toHaveAttribute('onclick');
    expect(container.querySelector('script,input')).not.toBeInTheDocument();
  });

  it('hydrates existing static markup and updates it without mounting an editor', () => {
    const content: JSONContent = { type: 'doc', content: [paragraph('Server rendered')] };
    const container = document.createElement('div');
    const viewer = <StaticViewer content={content} />;
    container.innerHTML = renderToString(viewer);
    const paragraphElement = container.querySelector('p');
    expect(paragraphElement?.textContent).toBe('Server rendered');

    const { rerender } = render(viewer, { container, hydrate: true });
    expect(container.querySelector('p')).toBe(paragraphElement);
    rerender(<StaticViewer content={{ type: 'doc', content: [paragraph('Client update')] }} />);
    expect(container.querySelector('p')?.textContent).toBe('Client update');
    expect(container.querySelector('[contenteditable]')).toBeNull();
  });

  it('falls back to an empty shell for content outside the core schema', () => {
    const { container } = render(
      <StaticViewer
        content={{
          type: 'doc',
          content: [{ type: 'mention', attrs: { id: 'u1', label: 'ada' } }],
        }}
      />,
    );

    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
    expect(container.querySelector('.inkio-content')?.textContent).toBe('');
  });
});
