import type { JSONContent } from '@tiptap/core';

export interface InkioServerAdapter {
  /** Convert Tiptap JSON content to HTML string */
  blocksToHtml: (content: JSONContent) => Promise<string>;
  /** Parse HTML string into Tiptap JSON content */
  htmlToBlocks: (html: string) => Promise<JSONContent>;
  /** Convert Tiptap JSON content to Markdown string */
  blocksToMarkdown: (content: JSONContent) => Promise<string>;
  /** Parse Markdown string into Tiptap JSON content */
  markdownToBlocks: (markdown: string) => Promise<JSONContent>;
}

/**
 * Creates a server-side adapter for format conversions.
 *
 * TODO: Current implementation is a placeholder that returns JSON stringified content.
 * Planned work:
 * - blocksToHtml: Use ProseMirror DOMSerializer with generateHTML from @tiptap/html
 * - htmlToBlocks: Use ProseMirror DOMParser with generateJSON from @tiptap/html
 * - blocksToMarkdown: Implement a Tiptap JSON → Markdown serializer (or use prosemirror-markdown)
 * - markdownToBlocks: Implement a Markdown → Tiptap JSON parser (or use prosemirror-markdown)
 */
export function createInkioServerAdapter(): InkioServerAdapter {
  return {
    async blocksToHtml(content) {
      // TODO: Use @tiptap/html generateHTML() with the editor schema
      return JSON.stringify(content);
    },
    async htmlToBlocks(html) {
      // TODO: Use @tiptap/html generateJSON() with the editor schema
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: html }] }] };
    },
    async blocksToMarkdown(content) {
      // TODO: Implement Tiptap JSON → Markdown serializer
      return JSON.stringify(content);
    },
    async markdownToBlocks(markdown) {
      // TODO: Implement Markdown → Tiptap JSON parser
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: markdown }] }] };
    },
  };
}
