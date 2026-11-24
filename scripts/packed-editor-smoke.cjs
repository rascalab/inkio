// Executed inside the isolated tarball consumer, not against workspace packages.
const assert = require('node:assert/strict');
const { Window } = require('happy-dom');
const window = new Window({ url: 'https://example.org/' });
window.document.body.appendChild(window.document.createElement('main'));
for (const key of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'ShadowRoot', 'Event', 'CustomEvent', 'MutationObserver', 'DOMParser', 'AbortController', 'AbortSignal', 'ResizeObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
}
for (const key of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  globalThis[key] = window[key].bind(window);
}

const { createElement } = require('react');
const { createRoot } = require('react-dom/client');
const { Editor, read } = require('@inkio/editor');
const { Markdown } = require('@inkio/editor/markdown');
const root = createRoot(document.querySelector('main'));

// A live/saved equality check alone passes when both projections lose content.
// Cover the shipped schema, with independent expectations for visible words and block counts.
function checkSchema(editor) {
  const node = (type, content, attrs) => ({ type, content, attrs });
  const text = value => ({ type: 'text', text: value });
  const paragraph = value => node('paragraph', [text(value)]);
  const leaf = (type, attrs) => ({ type, attrs });
  const marks = Object.keys(editor.schema.marks).map(type => ({
    ...text(type + ' '), marks: [{ type, attrs: type === 'link' ? { href: '/ref' } : type === 'comment' ? { commentId: 'thread' } : {} }],
  }));
  const ref = { id: 'u1', label: 'Ada' };
  const content = [
    node('paragraph', marks),
    node('heading', [leaf('mention', ref), node('hardBreak'), leaf('hashTag', { id: 'tip' }), text(' '), leaf('wikiLink', { href: 'Guide' })]),
    node('bulletList', [node('listItem', [paragraph('bullet')])]),
    node('orderedList', [node('listItem', [paragraph('ordered')])]),
    node('taskList', [node('taskItem', [paragraph('task')])]),
    node('blockquote', [paragraph('quote')]), node('horizontalRule'),
    node('codeBlock', [text('  indented\n\n\nlast')]),
    leaf('imageBlock', { src: '/pic.png', caption: 'Caption' }),
    node('callout', [paragraph('notice')]),
    node('details', [node('detailsSummary', [text('Summary')]), node('detailsContent', [paragraph('Body')])]),
    node('table', [node('tableRow', [node('tableHeader', [paragraph('Header')]), node('tableCell', [paragraph('Cell')])])]),
    node('tocBlock'), leaf('bookmark', { url: '/reference', title: 'Reference' }),
  ];
  const raw = { type: 'doc', content };
  assert.equal(editor.commands.setContent(raw), true);
  const types = new Set(['doc']);
  let blocks = 0;
  editor.state.doc.descendants(n => { types.add(n.type.name); if (n.isBlock) blocks++; });
  assert.deepEqual(types, new Set(Object.keys(editor.schema.nodes)), 'a default node is missing from the consumer fixture');
  for (const doc of [editor, read(raw)]) {
    assert.equal(doc.stats.blocks, blocks);
    for (const word of ['@Ada', '#tip', 'Guide', 'bullet', 'ordered', 'task', 'quote', '  indented\n\n\nlast', 'Caption', 'notice', 'Header', 'Cell', 'Reference', ...Object.keys(editor.schema.marks)]) {
      assert.ok(doc.text.includes(word), `missing document text: ${word}`);
    }
    assert.match(doc.text, /Summary\s+Body/);
    assert.deepEqual(doc.mentions, [ref]);
    assert.deepEqual(doc.hashTags, ['tip']);
    assert.deepEqual(doc.commentIds, ['thread']);
  }
}

async function smoke() {
  const ready = Promise.withResolvers();
  const timeout = setTimeout(() => ready.reject(new Error('Editor did not mount')), 10000);
  try {
    root.render(createElement(Editor, {
      content: { type: 'doc', content: [{ type: 'bookmark', attrs: { url: 'https://example.org/', title: 'Guide' } }] },
      extensions: [Markdown],
      onCreate: ready.resolve,
    }));
    const editor = await ready.promise;
    assert.match(editor.text, /Guide/);
    assert.match(read(editor.getJSON()).summary(), /Guide/);
    checkSchema(editor);
    editor.markdown = '## Updated';
    assert.equal(editor.headings[0].text, 'Updated');
    assert.equal(editor.markdown, '## Updated');
    const wide = value => '|' + Array(129).fill(value).join('|') + '|';
    const rejected = [wide('H'), wide('---'), wide('V')].join('\n');
    assert.equal('setMarkdown' in editor, false);
    assert.throws(() => { editor.markdown = rejected; });
    assert.equal(editor.markdown, '## Updated');
  } finally {
    clearTimeout(timeout);
    root.unmount();
    await window.happyDOM.close();
  }
}

smoke().catch(error => { console.error(error); process.exitCode = 1; });
