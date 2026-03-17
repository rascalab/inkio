import { act } from 'react';
import { render, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Editor } from '../Editor';

describe('Editor component', () => {
  it('should render without crashing with default props', () => {
    const { container } = render(<Editor />);
    expect(container.querySelector('.inkio-editor')).toBeInTheDocument();
  });

  it('should render with HTML string content', () => {
    const { container } = render(<Editor content="<p>Hello World</p>" />);
    expect(container.querySelector('.inkio-editor')).toBeInTheDocument();
  });

  it('should render with JSON content', () => {
    const jsonContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Test content' }],
        },
      ],
    };
    const { container } = render(<Editor content={jsonContent} />);
    expect(container.querySelector('.inkio-editor')).toBeInTheDocument();
  });

  it('should accept empty string content', () => {
    const { container } = render(<Editor content="" />);
    expect(container.querySelector('.inkio-editor')).toBeInTheDocument();
  });

  it('should apply className', () => {
    const { container } = render(<Editor className="custom-class" />);
    expect(container.querySelector('.inkio-editor')).toBeInTheDocument();
  });

  it('keeps wrapper className off the static document root', () => {
    const html = renderToString(<Editor className="layout-shell" content="<p>Hello</p>" />);

    expect(html).toContain('class="inkio inkio-editor inkio-container-default layout-shell"');
    expect(html).not.toContain('inkio-editor-static layout-shell');
  });

  it('should apply custom style', () => {
    const { container } = render(<Editor style={{ padding: '20px' }} />);
    const wrapper = container.querySelector('.inkio-editor') as HTMLElement;
    expect(wrapper.style.padding).toBe('20px');
  });

  it('should opt into parent-fill layout when fill is enabled', () => {
    const { container } = render(<Editor fill />);
    expect(container.querySelector('.inkio-editor--fill')).toBeInTheDocument();
  });

  it('should throw if content and initialContent are both provided', () => {
    expect(() =>
      render(
        <Editor
          content={{ type: 'doc', content: [] } as any}
          initialContent={{ type: 'doc', content: [] } as any}
        />
      )
    ).toThrow('content');
  });

  it('renders static document HTML during server render', () => {
    const html = renderToString(<Editor content="<h2>SSR Heading</h2><p>Hello SSR</p>" showToolbar />);

    expect(html).toContain('SSR Heading');
    expect(html).toContain('inkio-editor-static');
    expect(html).toContain('inkio-toolbar--ssr-placeholder');
  });

  it('hydrates from static HTML into the interactive editor runtime', async () => {
    const markup = renderToString(<Editor content="<p>Hydrate me</p>" showToolbar />);
    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.appendChild(container);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | null = null;

    try {
      await act(async () => {
        root = hydrateRoot(container, <Editor content="<p>Hydrate me</p>" showToolbar />);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(container.querySelector('[data-inkio-editor-static]')).not.toBeInTheDocument();
      });
      expect(container.querySelector('.ProseMirror')).toBeInTheDocument();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        root?.unmount();
      });
      consoleError.mockRestore();
      container.remove();
    }
  });
});
