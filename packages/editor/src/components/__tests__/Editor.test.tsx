import { render } from '@testing-library/react';
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

  it('should apply custom style', () => {
    const { container } = render(<Editor style={{ padding: '20px' }} />);
    const wrapper = container.querySelector('.inkio-editor') as HTMLElement;
    expect(wrapper.style.padding).toBe('20px');
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
});
