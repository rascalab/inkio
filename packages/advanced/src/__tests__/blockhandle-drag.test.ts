import { fireEvent } from '@testing-library/dom';
import { Editor, Extension, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { history, undo, undoDepth } from '@tiptap/pm/history';
import { NodeSelection } from '@tiptap/pm/state';
import { BlockHandle } from '../extensions/BlockHandle';

const BulletList = Node.create({
  name: 'bulletList',
  group: 'block',
  content: 'listItem+',
  parseHTML: () => [{ tag: 'ul' }],
  renderHTML: () => ['ul', 0],
});

const ListItem = Node.create({
  name: 'listItem',
  content: 'paragraph block*',
  parseHTML: () => [{ tag: 'li' }],
  renderHTML: () => ['li', 0],
});

let editor: Editor;
let mount: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  mount = document.body.appendChild(document.createElement('div'));
  editor = new Editor({
    element: mount,
    extensions: [Document, Paragraph, Text, BulletList, ListItem, BlockHandle, Extension.create({
      name: 'testHistory',
      addProseMirrorPlugins: () => [history()],
    })],
    content: '<p>Source</p><ul><li><p>First</p></li><li><p>Second</p></li></ul>',
  });
  vi.spyOn(editor.view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 0, 300, 120));
  vi.spyOn(editor.view, 'posAtCoords').mockImplementation(({ top }) => {
    if (top < 30) return { pos: 2, inside: 0 };
    if (top < 60) return { pos: 12, inside: 10 };
    return { pos: 21, inside: 19 };
  });
  const bounds = [new DOMRect(50, 0, 300, 20), new DOMRect(70, 30, 280, 20), new DOMRect(70, 60, 280, 20)];
  const blocks = [editor.view.dom.firstElementChild!, ...editor.view.dom.querySelectorAll('li')];
  blocks.forEach((element, index) => {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(bounds[index]);
  });
});

afterEach(() => {
  editor.destroy();
  mount.remove();
  vi.useRealTimers();
});

function dragEvent(type: string, clientY: number, dataTransfer: object) {
  const event = new MouseEvent(type, { clientX: 80, clientY, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  return event;
}

function pickUp(source: Element, y: number) {
  fireEvent.pointerMove(source, { pointerType: 'mouse', clientX: 80, clientY: y });
  vi.advanceTimersToNextFrame();
  const handle = document.querySelector<HTMLButtonElement>('[data-block-handle]')!;
  expect(handle).toHaveClass('visible');
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (format: string, value: string) => data.set(format, value),
    getData: (format: string) => data.get(format) ?? '',
    setDragImage: vi.fn<(preview: HTMLElement, offsetX: number, offsetY: number) => void>(),
  };
  fireEvent(handle, dragEvent('dragstart', y, dataTransfer));
  vi.advanceTimersToNextFrame();
  return { handle, dataTransfer };
}

function touch(target: Element, type: string, clientX: number, clientY: number) {
  return fireEvent(target, new PointerEvent(type, {
    pointerType: 'touch',
    pointerId: 7,
    isPrimary: true,
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  }));
}

function revealTouchHandle(source: Element, y: number) {
  expect(touch(source, 'pointerdown', 80, y)).toBe(true);
  expect(touch(source, 'pointerup', 80, y)).toBe(true);
  const handle = document.querySelector<HTMLButtonElement>('[data-block-handle]')!;
  expect(handle).toHaveClass('visible');
  const capture = vi.fn();
  Object.defineProperty(handle, 'setPointerCapture', { configurable: true, value: capture });
  touch(handle, 'pointerdown', 35, y);
  expect(capture).toHaveBeenCalledWith(7);
  return handle;
}

describe('block handle pickup', () => {
  it('uses an inert preview of the list item and restores the caret when canceled', () => {
    const before = editor.state.selection;
    const item = editor.view.dom.querySelector('li')!;
    const { handle, dataTransfer } = pickUp(item, 40);

    const [preview] = dataTransfer.setDragImage.mock.calls[0];
    expect(preview.matches('.inkio-block-drag-preview[data-drag-mode="native"][inert]')).toBe(true);
    expect(preview.querySelector('ul > li')).toHaveTextContent('First');
    expect(editor.view.dom.querySelectorAll('li')).toHaveLength(2);
    expect(preview).not.toBeInTheDocument();
    expect(dataTransfer.getData('text/html')).toBe('<ul><li><p>First</p></li></ul>');
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.view.dom.querySelector('.ProseMirror-selectednode')?.textContent).toBe('First');
    expect(editor.view.dom).toHaveClass('inkio-block-pickup');

    const second = editor.view.dom.querySelectorAll('li')[1];
    fireEvent(second, dragEvent('dragover', 76, dataTransfer));
    expect(document.querySelector('.inkio-block-drop-marker')).not.toBeNull();
    fireEvent(handle, dragEvent('dragend', 76, dataTransfer));

    expect(editor.view.dom).not.toHaveClass('inkio-block-pickup');
    expect(document.querySelector('.inkio-block-drop-marker')).toBeNull();
    expect(editor.view.dragging).toBeNull();
    expect(editor.state.selection.eq(before)).toBe(true);
    expect(document.querySelectorAll('li')).toHaveLength(2);
  });

  it('keeps the line at the same list gap from either side, and drops there', () => {
    const source = editor.view.dom.querySelector('p')!;
    const [first, second] = editor.view.dom.querySelectorAll('li');
    const { dataTransfer } = pickUp(source, 10);

    fireEvent(first, dragEvent('dragover', 47, dataTransfer));
    const marker = document.querySelector<HTMLElement>('.inkio-block-drop-marker')!;
    expect(marker.style.top).toBe('55px');
    fireEvent(second, dragEvent('dragover', 63, dataTransfer));
    expect(marker.style.top).toBe('55px');

    fireEvent(second, dragEvent('drop', 63, dataTransfer));

    expect(editor.getHTML()).toBe('<ul><li><p>First</p></li></ul><p>Source</p><ul><li><p>Second</p></li></ul>');
    expect(document.querySelector('.inkio-block-drop-marker')).toBeNull();
  });

  it('moves a list item with its wrapper to the root gap shown by the marker', () => {
    const before = editor.getHTML();
    const paragraph = editor.view.dom.querySelector('p')!;
    const [, second] = editor.view.dom.querySelectorAll('li');
    const { dataTransfer } = pickUp(second, 68);

    fireEvent(paragraph, dragEvent('dragover', 4, dataTransfer));
    const marker = document.querySelector<HTMLElement>('.inkio-block-drop-marker');
    expect(marker).toHaveStyle({ top: '0px', left: '50px', width: '300px' });

    fireEvent(paragraph, dragEvent('drop', 4, dataTransfer));
    expect(editor.getHTML()).toBe('<ul><li><p>Second</p></li></ul><p>Source</p><ul><li><p>First</p></li></ul>');
    expect(marker).not.toBeInTheDocument();
    expect(undoDepth(editor.state)).toBe(1);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.getHTML()).toBe(before);
  });

  it('clears the pickup on a document edit and does not paste stale drag data back', () => {
    const source = editor.view.dom.querySelector('p')!;
    const { handle, dataTransfer } = pickUp(source, 10);
    editor.commands.insertContentAt(2, '!');
    const edited = editor.getHTML();

    expect(editor.view.dom).not.toHaveClass('inkio-block-pickup');
    expect(editor.view.dragging).toBeNull();
    expect(fireEvent(editor.view.dom, dragEvent('drop', 47, dataTransfer))).toBe(false);
    expect(editor.getHTML()).toBe(edited);
    fireEvent(handle, dragEvent('dragend', 47, dataTransfer));
  });

  it('hides the editing affordances and refuses an in-flight drop in read-only mode', () => {
    const source = editor.view.dom.querySelector('p')!;
    const { handle, dataTransfer } = pickUp(source, 10);
    editor.setEditable(false);

    expect(handle).not.toHaveClass('visible');
    expect(handle.tabIndex).toBe(-1);
    expect(editor.view.dom).not.toHaveClass('inkio-block-pickup');
    expect(editor.view.dragging).toBeNull();

    const before = editor.getHTML();
    fireEvent(editor.view.dom, dragEvent('drop', 47, dataTransfer));
    expect(editor.getHTML()).toBe(before);
    fireEvent(handle, dragEvent('dragend', 47, dataTransfer));
  });
});

describe('touch block pickup', () => {
  it('ignores a content swipe rather than intercepting normal scroll', () => {
    const source = editor.view.dom.querySelector('p')!;
    expect(touch(source, 'pointerdown', 80, 10)).toBe(true);
    expect(touch(source, 'pointermove', 80, 45)).toBe(true);
    expect(touch(source, 'pointercancel', 80, 45)).toBe(true);
    expect(document.querySelector('[data-block-handle]')).not.toHaveClass('visible');
  });

  it('starts at the grip only after the threshold, and cancels without changing the selection', () => {
    const source = editor.view.dom.querySelector('p')!;
    const [first] = editor.view.dom.querySelectorAll('li');
    const before = editor.state;
    const handle = revealTouchHandle(source, 10);
    touch(handle, 'pointermove', 39, 12);
    expect(document.querySelector('.inkio-block-drag-preview')).toBeNull();
    touch(handle, 'pointermove', 80, 47);
    const preview = document.querySelector<HTMLElement>('.inkio-block-drag-preview[data-drag-mode="touch"][inert]')!;
    expect(preview.querySelector('p')).toHaveTextContent('Source');
    expect(editor.view.dom).not.toContainElement(preview);
    expect(editor.state.selection.eq(before.selection)).toBe(true);
    expect(editor.view.dragging).toBeNull();
    const marker = document.querySelector<HTMLElement>('.inkio-block-drop-marker')!;
    expect(marker.style.top).toBe('55px');
    touch(handle, 'pointermove', 80, 63);
    expect(marker.style.top).toBe('55px');
    touch(handle, 'pointercancel', 80, 63);
    expect(preview).not.toBeInTheDocument();
    expect(marker).not.toBeInTheDocument();
    expect(first).toBeInTheDocument();
    expect(editor.state.doc).toBe(before.doc);
    expect(editor.state.selection.eq(before.selection)).toBe(true);
    expect(undoDepth(editor.state)).toBe(0);
  });

  it('moves through the indicated list gap in one undoable edit', () => {
    const before = editor.getHTML();
    const handle = revealTouchHandle(editor.view.dom.querySelector('p')!, 10);
    touch(handle, 'pointermove', 80, 47);
    touch(handle, 'pointerup', 80, 47);
    expect(editor.getHTML()).toBe('<ul><li><p>First</p></li></ul><p>Source</p><ul><li><p>Second</p></li></ul>');
    expect(document.querySelector('.inkio-block-drag-preview')).toBeNull();
    expect(document.querySelector('.inkio-block-drop-marker')).toBeNull();
    expect(undoDepth(editor.state)).toBe(1);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.getHTML()).toBe(before);
  });

  it('reorders an item within its compatible list without splitting it', () => {
    const [, second] = editor.view.dom.querySelectorAll('li');
    const handle = revealTouchHandle(second, 68);
    touch(handle, 'pointermove', 80, 32);
    expect(document.querySelector('.inkio-block-drop-marker')).not.toBeNull();
    touch(handle, 'pointerup', 80, 32);
    expect(editor.getHTML()).toBe('<p>Source</p><ul><li><p>Second</p></li><li><p>First</p></li></ul>');
  });

  it('moves an item outside the list with its wrapper intact', () => {
    const [, second] = editor.view.dom.querySelectorAll('li');
    const handle = revealTouchHandle(second, 68);
    touch(handle, 'pointermove', 80, 4);
    expect(document.querySelector('.inkio-block-drop-marker')).not.toBeNull();
    touch(handle, 'pointerup', 80, 4);
    expect(editor.getHTML()).toBe('<ul><li><p>Second</p></li></ul><p>Source</p><ul><li><p>First</p></li></ul>');
  });

  it.each(['outside', 'lost capture', 'read-only'])('cleans up a touch move on %s', (reason) => {
    const before = editor.getHTML();
    const handle = revealTouchHandle(editor.view.dom.querySelector('p')!, 10);
    touch(handle, 'pointermove', 80, 47);
    expect(document.querySelector('.inkio-block-drop-marker')).not.toBeNull();
    if (reason === 'outside') touch(handle, 'pointerup', 10, 47);
    if (reason === 'lost capture') touch(handle, 'lostpointercapture', 80, 47);
    if (reason === 'read-only') editor.setEditable(false);
    expect(editor.getHTML()).toBe(before);
    expect(document.querySelector('.inkio-block-drag-preview')).toBeNull();
    expect(document.querySelector('.inkio-block-drop-marker')).toBeNull();
    expect(handle).not.toHaveClass('visible');
    expect(undoDepth(editor.state)).toBe(0);
  });
});
