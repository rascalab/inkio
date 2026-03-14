import { Mention } from '../Mention/Mention';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

describe('Mention extension', () => {
  it('should have correct name', () => {
    expect(Mention.name).toBe('mention');
  });

  it('should not call window.getSelection in suggestion command handler', () => {
    const options = Mention.config.addOptions?.call({ name: 'mention' } as any);
    const source = options?.suggestion?.command?.toString() ?? '';
    expect(source).not.toContain('collapseToEnd');
  });

  it('should render data-type=\"mention\" matching saved markup', () => {
    const schema = getSchema([Document, Paragraph, Text, Mention]);
    const node = schema.nodes.mention.create({ id: '1', label: 'alice' });
    const options = Mention.config.addOptions?.call({ name: 'mention' } as any);

    const renderResult = Mention.config.renderHTML!.call(
      { options } as any,
      {
        HTMLAttributes: {
          'data-id': '1',
          'data-label': 'alice',
        },
        node,
      } as any,
    );

    expect(Array.isArray(renderResult)).toBe(true);
    const attrs = (renderResult as unknown as any[])[1] as Record<string, string>;
    expect(attrs['data-type']).toBe('mention');
    expect(attrs['data-mention']).toBe('');
  });
});
