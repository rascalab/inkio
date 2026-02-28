import { render } from '@testing-library/react';
import { Viewer } from '../Viewer';

describe('Viewer component', () => {
  it('should render without crashing with default props', () => {
    const { container } = render(<Viewer />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
  });

  it('should render with HTML string content', () => {
    const { container } = render(<Viewer content="<p>Hello World</p>" />);
    expect(container.querySelector('.inkio-viewer')).toBeInTheDocument();
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
});
