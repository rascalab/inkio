import { describe, expect, it } from 'vitest';
import { Editor, getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { HashTag, HashTagPluginKey } from '../extensions/HashTag';
import { Mention, MentionPluginKey } from '../extensions/Mention';
import { hashTagClickPluginKey, mentionClickPluginKey } from '../extensions/inline-node-click';

/**
 * Output parity for Mention/HashTag: the expected values were captured from
 * the pre-factory (hand-written clone) implementations so the shared
 * trigger-node factory is provably behavior-preserving.
 */
const CONTENT = [
  '<p>hi ',
  '<span data-type="mention" data-id="u1" data-label="alice">@alice</span> ',
  '<span data-type="mention" data-id="u2">@u2</span> ',
  '<span data-mention="" data-id="u3" data-label="bob" data-mention-suggestion-char="+">@bob</span> ',
  '<span data-type="hashTag" data-id="t1" data-label="react">#react</span> ',
  '<span data-hashtag="" data-id="t2">#t2</span>',
  '</p>',
].join('');

function createEditor(content: unknown = CONTENT) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      Document,
      Paragraph,
      Text,
      Mention.configure({ HTMLAttributes: { class: 'm' } }),
      HashTag,
    ],
    content: content as string,
  });
}

describe('Mention/HashTag output parity', () => {
  it('parses and serializes HTML identically', () => {
    const editor = createEditor();
    expect(editor.getHTML()).toMatchInlineSnapshot(`"<p>hi <span data-mention="" data-type="mention" class="m" data-id="u1" data-label="alice">@alice</span> <span data-mention="" data-type="mention" class="m" data-id="u2">@u2</span> <span data-mention="" data-type="mention" class="m" data-id="u3" data-label="bob">@bob</span> <span data-hashtag="" data-type="hashTag" data-id="t1" data-label="react">#react</span> <span data-hashtag="" data-type="hashTag" data-id="t2">#t2</span></p>"`);
    editor.destroy();
  });

  it('serializes JSON identically', () => {
    const editor = createEditor();
    expect(editor.getJSON()).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "content": [
              {
                "text": "hi ",
                "type": "text",
              },
              {
                "attrs": {
                  "id": "u1",
                  "label": "alice",
                  "mentionSuggestionChar": "@",
                },
                "type": "mention",
              },
              {
                "text": " ",
                "type": "text",
              },
              {
                "attrs": {
                  "id": "u2",
                  "label": null,
                  "mentionSuggestionChar": "@",
                },
                "type": "mention",
              },
              {
                "text": " ",
                "type": "text",
              },
              {
                "attrs": {
                  "id": "u3",
                  "label": "bob",
                  "mentionSuggestionChar": "+",
                },
                "type": "mention",
              },
              {
                "text": " ",
                "type": "text",
              },
              {
                "attrs": {
                  "id": "t1",
                  "label": "react",
                  "mentionSuggestionChar": "#",
                },
                "type": "hashTag",
              },
              {
                "text": " ",
                "type": "text",
              },
              {
                "attrs": {
                  "id": "t2",
                  "label": null,
                  "mentionSuggestionChar": "#",
                },
                "type": "hashTag",
              },
            ],
            "type": "paragraph",
          },
        ],
        "type": "doc",
      }
    `);
    editor.destroy();
  });

  it('serializes text identically', () => {
    const editor = createEditor();
    expect(editor.getText()).toMatchInlineSnapshot(`"hi @alice @u2 @bob #react #t2"`);
    editor.destroy();
  });

  it('round-trips JSON to the same HTML', () => {
    const editor = createEditor();
    const json = editor.getJSON();
    const second = createEditor(json);
    expect(second.getHTML()).toBe(editor.getHTML());
    editor.destroy();
    second.destroy();
  });

  it('insert commands produce the same nodes', () => {
    const editor = createEditor('<p></p>');
    editor.commands.insertMention({ id: 'x', label: 'Xavier' });
    editor.commands.insertHashTag({ id: 'y', label: 'yak' });
    expect(editor.getJSON()).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "content": [
              {
                "attrs": {
                  "id": "x",
                  "label": "Xavier",
                  "mentionSuggestionChar": "@",
                },
                "type": "mention",
              },
              {
                "attrs": {
                  "id": "y",
                  "label": "yak",
                  "mentionSuggestionChar": "#",
                },
                "type": "hashTag",
              },
            ],
            "type": "paragraph",
          },
        ],
        "type": "doc",
      }
    `);
    expect(editor.getHTML()).toMatchInlineSnapshot(`"<p><span data-mention="" data-type="mention" class="m" data-id="x" data-label="Xavier">@Xavier</span><span data-hashtag="" data-type="hashTag" data-id="y" data-label="yak">#yak</span></p>"`);
    editor.destroy();
  });

  it('keeps names, attrs and option shape', () => {
    expect(Mention.name).toBe('mention');
    expect(HashTag.name).toBe('hashTag');
    const schema = getSchema([Document, Paragraph, Text, Mention, HashTag]);
    expect(Object.keys(schema.nodes.mention.spec.attrs ?? {})).toEqual(['id', 'label', 'mentionSuggestionChar']);
    expect(Object.keys(schema.nodes.hashTag.spec.attrs ?? {})).toEqual(['id', 'label', 'mentionSuggestionChar']);
    expect(schema.nodes.mention.spec.attrs?.mentionSuggestionChar.default).toBe('@');
    expect(schema.nodes.hashTag.spec.attrs?.mentionSuggestionChar.default).toBe('#');

    const editor = createEditor('<p></p>');
    const mention = editor.extensionManager.extensions.find((ext) => ext.name === 'mention')!;
    const hashTag = editor.extensionManager.extensions.find((ext) => ext.name === 'hashTag')!;
    for (const ext of [mention, hashTag]) {
      expect(Object.keys(ext.options)).toEqual(expect.arrayContaining([
        'HTMLAttributes',
        'suggestions',
        'items',
        'onError',
        'onClick',
        'deleteTriggerWithBackspace',
        'suggestion',
        'renderText',
        'renderHTML',
      ]));
    }
    expect(mention.options.suggestion.char).toBe('@');
    expect(hashTag.options.suggestion.char).toBe('#');
    expect(mention.options.suggestion.pluginKey).toBe(MentionPluginKey);
    expect(hashTag.options.suggestion.pluginKey).toBe(HashTagPluginKey);
    expect(mention.options.renderText({ node: { attrs: { id: 'a', label: null } } })).toBe('@a');
    expect(hashTag.options.renderText({ node: { attrs: { id: 'a', label: 'b' } } })).toBe('#b');

    const keys = editor.state.plugins.map((plugin) => (plugin.spec as { key?: unknown }).key);
    expect(keys).toEqual(expect.arrayContaining([
      MentionPluginKey,
      HashTagPluginKey,
      mentionClickPluginKey,
      hashTagClickPluginKey,
    ]));
    editor.destroy();
  });
});
