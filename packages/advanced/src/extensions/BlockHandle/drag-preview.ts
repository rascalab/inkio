const OMIT_FROM_PREVIEW = [
  'button, input, textarea, select, iframe, object, embed, script, style, link, meta, base, template, audio, video',
  '[data-block-handle], [role="button"], [role="toolbar"], [hidden]',
  '.inkio-image-block-resize-handle, .inkio-image-block-toolbar',
].join(', ');

/** Clone the block's rendered content without mounting another NodeView or copying its controls. */
export function createBlockDragPreview(source: HTMLElement, mode: 'native' | 'touch') {
  const doc = source.ownerDocument;
  const preview = doc.createElement('div');
  preview.className = 'inkio inkio-block-drag-preview';
  preview.dataset.dragMode = mode;
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('inert', '');

  const content = doc.createElement('div');
  content.className = 'inkio-content inkio-block-drag-preview-content';
  // Size the text independently of the card so its padding never causes reflow.
  const listSource = source.tagName === 'LI' && source.parentElement?.matches('ul, ol') ? source.parentElement : null;
  const layoutSource = listSource ?? source;
  content.style.width = `${layoutSource.getBoundingClientRect().width}px`;
  const inherited = doc.defaultView?.getComputedStyle(layoutSource.parentElement ?? layoutSource);
  if (inherited) {
    for (const property of [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing',
      'whiteSpace', 'overflowWrap', 'wordBreak', 'textAlign', 'direction', 'hyphens', 'tabSize',
    ] as const) {
      content.style[property] = inherited[property];
    }
  }
  preview.appendChild(content);

  let nodesLeft = 160;
  let textLeft = 4096;
  const cloneElement = (node: Element): Element => {
    // Never connect a second instance of an app-defined custom element.
    const clone = node.localName.includes('-') || node.hasAttribute('is')
      ? doc.createElement('div')
      : node.cloneNode(false) as Element;
    for (const attr of clone.getAttributeNames()) {
      if (/^(on|id$|name$|contenteditable$|tabindex$|autofocus$|draggable$|data-drag-handle$)/i.test(attr)) {
        clone.removeAttribute(attr);
      }
    }
    clone.classList.remove('ProseMirror-selectednode', 'inkio-block-selected', 'is-selected');
    return clone;
  };
  const copy = (node: Node, parent: Element) => {
    nodesLeft--;
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? '';
      parent.append(value.length <= textLeft ? value : `${value.slice(0, textLeft)}…`);
      textLeft -= value.length;
    } else if (node instanceof Element) {
      // Keep the rendered checkbox or caption, not another live form control.
      const isCheckbox = node.classList.contains('inkio-task-checkbox-btn');
      if (node instanceof HTMLInputElement && node.classList.contains('inkio-image-block-caption') && node.value) {
        const caption = doc.createElement('div');
        caption.className = node.className;
        caption.append(node.value.slice(0, textLeft));
        textLeft -= node.value.length;
        parent.appendChild(caption);
        return;
      }
      if (!isCheckbox && node.matches(OMIT_FROM_PREVIEW)) return;
      const clone = isCheckbox ? doc.createElement('span') : cloneElement(node);
      if (isCheckbox) clone.className = node.className;
      parent.appendChild(clone);
      for (let child = node.firstChild; child && nodesLeft > 0 && textLeft > 0; child = child.nextSibling) {
        copy(child, clone);
      }
    }
  };

  if (listSource) {
    const list = cloneElement(listSource);
    content.appendChild(list);
    copy(source, list);
  } else {
    copy(source, content);
  }
  return preview;
}
