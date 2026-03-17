import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Viewer } from '../Viewer';

describe('Viewer component', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('should render without crashing with default props', () => {
    const { container } = render(<Viewer />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
  });

  it('should render with HTML string content', () => {
    const { container } = render(<Viewer content="<p>Hello World</p>" />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
  });

  it('keeps wrapper className off the static viewer document root', () => {
    const html = renderToString(<Viewer className="layout-shell" content="<p>Hello</p>" />);

    expect(html).toContain('class="inkio inkio-viewer inkio-container-default layout-shell"');
    expect(html).not.toContain('inkio-viewer-static layout-shell');
  });

  it('should accept empty string content (Fix #7)', () => {
    const { container } = render(<Viewer content="" />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
  });

  it('should render with JSON content', () => {
    const jsonContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Test' }],
        },
      ],
    };
    const { container } = render(<Viewer content={jsonContent} />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
  });

  it('should be non-editable by default', () => {
    const { container } = render(<Viewer content="<p>Read only</p>" />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
  });

  it('should throw if content and initialContent are both provided', () => {
    expect(() =>
      render(
        <Viewer
          content={{ type: 'doc', content: [] } as any}
          initialContent={{ type: 'doc', content: [] } as any}
        />
      )
    ).toThrow('content');
  });

  it('renders a built-in table of contents from heading content', async () => {
    render(
      <Viewer
        tableOfContents={{ position: 'left', maxLevel: 3 }}
        content={{
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Overview' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Body copy' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Details' }],
            },
          ],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Details' })).toBeInTheDocument();
    expect(document.querySelector('.inkio-viewer--toc-left')).toBeInTheDocument();
  });

  it('calls onHeadingsReady with extracted heading data and a scroll helper', async () => {
    const onHeadingsReady = vi.fn();

    render(
      <Viewer
        onHeadingsReady={onHeadingsReady}
        content={{
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Intro' }],
            },
          ],
        }}
      />
    );

    await waitFor(() => {
      expect(onHeadingsReady).toHaveBeenCalled();
    });

    const [headings, scrollToIndex] = onHeadingsReady.mock.lastCall as [
      Array<{ text: string; level: number }>,
      (index: number) => void,
    ];

    expect(headings).toEqual([
      expect.objectContaining({ text: 'Intro', level: 1 }),
    ]);
    expect(typeof scrollToIndex).toBe('function');
  });

  it('renders HTML content on the server with heading anchors for the built-in TOC', () => {
    const html = renderToString(
      <Viewer
        tableOfContents
        content="<h2>Server heading</h2><p>SSR body</p>"
      />
    );

    expect(html).toContain('Server heading');
    expect(html).toContain('href="#server-heading"');
    expect(html).toContain('id="server-heading"');
  });
});
