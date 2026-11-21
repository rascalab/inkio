import { Component } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ImageEditorComponentProps } from '@inkio/core';
import { Editor } from '../components/Editor';

describe('@inkio/simple defaults', () => {
  it('shows the persistent toolbar by default', async () => {
    const { container } = render(<Editor content="<p>Hello</p>" />);

    await waitFor(() => {
      expect(container.querySelector('.inkio-toolbar')).toBeInTheDocument();
    });
  });

  it('opens a class-based image editor supplied by the host', async () => {
    class CustomImageEditor extends Component<ImageEditorComponentProps> {
      render() {
        return <div role="dialog" aria-label="Custom image editor">{this.props.imageSrc}</div>;
      }
    }
    const { findByRole } = render(<Editor
      content={{ type: 'doc', content: [{ type: 'imageBlock', attrs: { src: '/photo.jpg' } }] }}
      imageBlock={{ imageEditor: CustomImageEditor }}
    />);
    fireEvent.click(await findByRole('button', { name: 'Edit image' }));
    expect(await findByRole('dialog', { name: 'Custom image editor' })).toHaveTextContent('/photo.jpg');
  });
});
