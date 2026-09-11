import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { ImageBlock } from '../ImageBlock';

function createEditor(options: {
  onUpload?: (file: File) => Promise<string>;
  resolveFileUrl?: (url: string) => Promise<string>;
  onUploadError?: (error: Error) => void;
}) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      Document,
      Paragraph,
      Text,
      ImageBlock.configure({
        onUpload: options.onUpload,
        resolveFileUrl: options.resolveFileUrl,
        onUploadError: options.onUploadError,
      }),
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  });
}

function makeFile(content: string, name: string, type: string) {
  return new File([content], name, { type });
}

async function flushUploads(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 10); });
  }
}

function docText(editor: Editor) {
  return JSON.stringify(editor.getJSON());
}

/**
 * Upload callbacks are untrusted input: their return values must pass
 * isSafeUrl before reaching the document, and file bytes are sniffed so a
 * client-spoofed MIME type can't smuggle HTML/SVG script content in.
 */
describe('ImageBlock upload URL validation', () => {
  it('rejects a javascript: URL returned by onUpload', async () => {
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'javascript:alert(1)',
      onUploadError,
    });

    editor.commands.uploadImageBlock([makeFile('x', 'a.png', 'image/png')]);
    await flushUploads();

    expect(docText(editor)).not.toContain('javascript:');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('rejects an unsafe URL returned by resolveFileUrl', async () => {
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
      resolveFileUrl: async () => 'data:text/html,<script>alert(1)</script>',
      onUploadError,
    });

    editor.commands.uploadImageBlock([makeFile('x', 'a.png', 'image/png')]);
    await flushUploads();

    expect(docText(editor)).not.toContain('data:text/html');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('stores safe upload results', async () => {
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
    });

    editor.commands.uploadImageBlock([makeFile('x', 'a.png', 'image/png')]);
    await flushUploads();

    expect(docText(editor)).toContain('https://example.com/a.png');
    editor.destroy();
  });

  it('rejects files whose bytes look like markup despite an image MIME', async () => {
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
      onUploadError,
    });

    editor.commands.uploadImageBlock([
      makeFile('<svg onload="alert(1)">', 'evil.png', 'image/png'),
    ]);
    await flushUploads();

    expect(docText(editor)).not.toContain('https://example.com/a.png');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('setImageBlock command rejects unsafe src', () => {
    const editor = createEditor({});
    const result = editor.commands.setImageBlock({ src: 'javascript:alert(1)' });
    expect(result).toBe(false);
    expect(docText(editor)).not.toContain('javascript:');
    editor.destroy();
  });
});
