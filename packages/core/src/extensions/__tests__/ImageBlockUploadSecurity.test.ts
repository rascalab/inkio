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

  it('rejects markup hidden behind leading NUL bytes', async () => {
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
      onUploadError,
    });

    editor.commands.uploadImageBlock([
      makeFile('\0\0\0<svg onload="alert(1)">', 'evil.png', 'image/png'),
    ]);
    await flushUploads();

    expect(docText(editor)).not.toContain('https://example.com/a.png');
    expect(onUploadError).toHaveBeenCalled();
    editor.destroy();
  });

  it('clamps a negative upload pos to 0 instead of throwing', async () => {
    const onUploadError = vi.fn();
    const editor = createEditor({
      onUpload: async () => 'https://example.com/a.png',
      onUploadError,
    });

    expect(() =>
      editor.commands.uploadImageBlock([makeFile('x', 'a.png', 'image/png')], -50),
    ).not.toThrow();
    await flushUploads();

    expect(docText(editor)).toContain('https://example.com/a.png');
    expect(onUploadError).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('replaces the empty paragraph with the caret and continues below the image', async () => {
    const editor = createEditor({ onUpload: async () => 'https://example.com/a.png' });
    editor.commands.focus('end');

    editor.commands.uploadImageBlock([makeFile('x', 'a.png', 'image/png')]);
    await flushUploads();

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['imageBlock', 'paragraph']);
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(editor.state.selection.from).toBe(2);
    editor.destroy();
  });

  it('keeps several files in order', async () => {
    const urls = ['https://example.com/1.png', 'https://example.com/2.png'];
    const editor = createEditor({ onUpload: async () => urls.shift() as string });
    editor.commands.focus('end');

    editor.commands.uploadImageBlock([
      makeFile('x', '1.png', 'image/png'),
      makeFile('x', '2.png', 'image/png'),
    ]);
    await flushUploads();

    const nodes = editor.getJSON().content ?? [];
    expect(nodes.map((node) => node.type)).toEqual(['imageBlock', 'imageBlock', 'paragraph']);
    expect(nodes.map((node) => node.attrs?.src).slice(0, 2)).toEqual([
      'https://example.com/1.png',
      'https://example.com/2.png',
    ]);
    editor.destroy();
  });

  it('leaves the caret alone when an image lands elsewhere', async () => {
    const editor = createEditor({ onUpload: async () => 'https://example.com/a.png' });
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'keep' }] },
        { type: 'paragraph' },
      ],
    });
    editor.commands.setTextSelection(3);

    editor.commands.uploadImageBlock([makeFile('x', 'a.png', 'image/png')], 7);
    await flushUploads();

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph', 'imageBlock']);
    expect(editor.state.selection.from).toBe(3);
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
