import { render } from '@testing-library/react';
import { Editor } from '../components/Editor';

describe('@inkio/editor defaults', () => {
  it('does not show the persistent toolbar by default', () => {
    const { container } = render(<Editor initialContent="<p>Hello</p>" />);

    expect(container.querySelector('.inkio-toolbar')).not.toBeInTheDocument();
  });
});
