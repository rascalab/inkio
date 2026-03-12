import { HashTag } from '../HashTag/HashTag';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

describe('HashTag extension', () => {
  it('should render data-type="hashTag" matching CSS selectors', () => {
    const schema = getSchema([Document, Paragraph, Text, HashTag]);
    const node = schema.nodes.hashTag.create({ id: '1', label: 'react' });

    expect(node.type.name).toBe('hashTag');

    const renderResult = HashTag.config.renderHTML!.call(
      { options: { HTMLAttributes: {} } } as any,
      {
        HTMLAttributes: {
          'data-id': '1',
          'data-label': 'react',
        },
        node,
      } as any,
    );
    expect(renderResult).toBeDefined();
    expect(Array.isArray(renderResult)).toBe(true);
    const attrs = (renderResult as unknown as any[])[1] as Record<string, string>;
    expect(attrs['data-type']).toBe('hashTag');
  });
});
