import { render } from '@testing-library/react';
import { StaticViewer } from '../StaticViewer';

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
