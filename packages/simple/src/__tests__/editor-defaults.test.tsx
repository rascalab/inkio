import { render, waitFor } from '@testing-library/react';
import { Editor } from '../components/Editor';

describe('@inkio/simple defaults', () => {
  it('shows the persistent toolbar by default', async () => {
    const { container } = render(<Editor initialContent="<p>Hello</p>" />);

    await waitFor(() => {
      expect(container.querySelector('.inkio-toolbar')).toBeInTheDocument();
    });
  });
});
