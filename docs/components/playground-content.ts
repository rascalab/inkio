/** Shared initial content for playground editors (JSON format for SSR-safe rendering). */
export const PLAYGROUND_INITIAL_CONTENT = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Inkio Playground' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'rich text editor' },
        { type: 'text', text: ' for ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'production' },
        { type: 'text', text: ' workflows. Try ' },
        { type: 'text', marks: [{ type: 'strike' }], text: 'deleting' },
        { type: 'text', text: ' or ' },
        { type: 'text', marks: [{ type: 'code' }], text: 'inline code' },
        { type: 'text', text: ' formatting.' },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Text Formatting' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This shows ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'strike' }], text: 'strikethrough' },
        { type: 'text', text: ', and ' },
        { type: 'text', marks: [{ type: 'code' }], text: 'inline code' },
        { type: 'text', text: '. Combine ' },
        { type: 'text', marks: [{ type: 'bold' }, { type: 'italic' }], text: 'bold italic' },
        { type: 'text', text: ' too.' },
      ],
    },
    {
      type: 'blockquote',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Blockquotes highlight important information or quotes.' }] },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Lists' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'First item with ' },
                { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
                { type: 'text', text: ' text' },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Second item with a ' },
                { type: 'text', marks: [{ type: 'link', attrs: { href: 'https://github.com', target: '_blank' } }], text: 'link' },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Nested items' }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sub-item one' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sub-item two' }] }] },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install the package' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Import the editor' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start writing' }] }] },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Code Block' }] },
    {
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [
        {
          type: 'text',
          text: `import { Editor } from '@inkio/editor';\n\n<Editor\n  placeholder="Write..."\n  locale="ko"\n  onImageUpload={async (file) => URL.createObjectURL(file)}\n/>`,
        },
      ],
    },
    { type: 'horizontalRule' },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Interactive Features' }] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type ' }, { type: 'text', marks: [{ type: 'code' }], text: '/' }, { type: 'text', text: ' for slash commands' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type ' }, { type: 'text', marks: [{ type: 'code' }], text: '#' }, { type: 'text', text: ' for hashtag suggestions' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type ' }, { type: 'text', marks: [{ type: 'code' }], text: '[[page]]' }, { type: 'text', text: ' for wiki links' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Select text and press ' }, { type: 'text', marks: [{ type: 'code' }], text: 'Mod+Shift+M' }, { type: 'text', text: ' for comments' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Drag & drop images to test the image editor' }] }] },
      ],
    },
  ],
};
