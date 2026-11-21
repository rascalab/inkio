import { DOMSerializer } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';
import { dragSource, dropBesideListItem, pickupListGap, type BlockDragSource, type BlockPress, type DropCoords, type HoveredBlock } from './block-drop';
import type { BlockDragVisuals } from './drag-visuals';

type Pickup = BlockDragSource & {
  previousSelection: Selection;
  dragging: NonNullable<EditorView['dragging']>;
  canceled: boolean;
};

interface NativeDragOptions {
  view: EditorView;
  handle: HTMLButtonElement;
  signal: AbortSignal;
  visuals: BlockDragVisuals;
  getBlock: () => HoveredBlock | null;
  isTouchPressed: () => boolean;
  onPress: () => void;
  onLift: () => void;
  onHide: () => void;
}

export const createNativeBlockDrag = ({ view, handle, signal, visuals, getBlock, isTouchPressed, onPress, onLift, onHide }: NativeDragOptions) => {
  const doc = view.dom.ownerDocument;
  const listener = { signal };
  const capture = { signal, capture: true };
  let pressed: BlockPress | null = null;
  let pickup: Pickup | null = null;
  let previewFrame = 0;
  let dropTimer: ReturnType<typeof setTimeout> | undefined;
  let coords: DropCoords | null = null;

  const clearMarker = () => {
    coords = null;
    visuals.clearMarker();
  };

  const refreshMarker = () => {
    if (!coords || !pickup || pickup.canceled) return;
    const { clientX, clientY } = coords;
    const at = view.posAtCoords({ left: clientX, top: clientY });
    const gap = at && (pickupListGap(view, pickup, at.pos, clientY) ?? dropPoint(view.state.doc, at.pos, pickup.slice));
    visuals.showMarker(gap);
  };

  const clearPickup = (current: Pickup) => {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    clearMarker();
    visuals.clearPreview();
    view.dom.classList.remove('inkio-block-pickup');
    handle.classList.remove('is-dragging');
    if (view.dragging === current.dragging) view.dragging = null;
  };

  const finish = (current: Pickup) => {
    if (pickup !== current) return;
    pickup = null;
    clearTimeout(dropTimer);
    dropTimer = undefined;
    clearPickup(current);
    if (view.editable && view.state.doc === current.doc && view.state.selection.eq(current.selection)) {
      view.dispatch(view.state.tr.setSelection(current.previousSelection).setMeta('addToHistory', false));
      if (doc.activeElement === handle) view.focus();
    }
    onHide();
  };

  const getPress = (): BlockPress | null => {
    const block = getBlock();
    return block && { ...block, doc: view.state.doc };
  };

  handle.addEventListener('mousedown', (event) => {
    if (view.editable && event.button === 0) {
      pressed = getPress();
      if (pressed) onPress();
    }
    event.stopPropagation();
  }, listener);

  doc.addEventListener('mouseup', () => { pressed = null; }, listener);

  handle.addEventListener('dragstart', (event) => {
    const transfer = event.dataTransfer;
    const block = pressed ?? getPress();
    pressed = null;
    const source = block && dragSource(view, block);
    if (!view.editable || !transfer || pickup || isTouchPressed() || !source) {
      event.preventDefault();
      return;
    }

    const previousSelection = view.state.selection;
    const { selection, slice, blockElement } = source;
    const wrap = doc.createElement('div');
    wrap.appendChild(DOMSerializer.fromSchema(view.state.schema).serializeFragment(slice.content, { document: doc }));
    transfer.effectAllowed = 'copyMove';
    transfer.setData('text/html', wrap.innerHTML);
    transfer.setData('text/plain', selection.node.textContent);

    onLift();
    transfer.setDragImage(visuals.mountPreview(blockElement, 'native'), 16, 12);
    const dragging = { slice, move: true, node: selection };
    const current: Pickup = { ...source, previousSelection, dragging, canceled: false };
    pickup = current;
    view.dragging = dragging;
    view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false));
    if (pickup !== current || current.canceled) {
      event.preventDefault();
      if (pickup === current) finish(current);
      return;
    }
    handle.classList.add('is-dragging');
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      visuals.clearPreview();
      // ProseMirror may replace the selected block's DOM. Style the live
      // NodeSelection through the stable editor root instead.
      view.dom.classList.add('inkio-block-pickup');
    });
  }, listener);

  handle.addEventListener('dragend', () => { if (pickup) finish(pickup); }, listener);
  // Replace the independent ProseMirror dropcursor only for our own drags.
  view.dom.addEventListener('dragover', (event) => {
    if (!pickup) return;
    event.stopImmediatePropagation();
    if (!pickup.canceled && view.editable) {
      event.preventDefault();
      coords = { clientX: event.clientX, clientY: event.clientY };
      refreshMarker();
    }
  }, capture);

  view.dom.addEventListener('dragleave', (event) => {
    if (pickup && !(event.relatedTarget instanceof Node && view.dom.contains(event.relatedTarget))) clearMarker();
  }, listener);

  doc.addEventListener('drop', (event) => {
    const current = pickup;
    if (!current) return;
    clearMarker();
    // Never let an invalidated internal drag become an external paste.
    if (current.canceled && event.target instanceof Node && view.dom.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
    // ProseMirror still needs the dragging record while handling the drop.
    clearTimeout(dropTimer);
    dropTimer = setTimeout(() => finish(current), 0);
  }, capture);

  return {
    get isActive() { return pickup !== null; },
    refreshMarker,
    handleDrop(event: DragEvent, move: boolean) {
      if (!pickup || pickup.canceled) return false;
      const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
      const gap = at && pickupListGap(view, pickup, at.pos, event.clientY);
      return gap !== null && dropBesideListItem(view, gap, pickup, move);
    },
    update() {
      if (pickup && !pickup.canceled && (!view.editable || view.state.doc !== pickup.doc)) {
        pickup.canceled = true;
        clearPickup(pickup);
      }
    },
    destroy() {
      if (pickup) clearPickup(pickup);
      pickup = null;
      clearTimeout(dropTimer);
    },
  };
};
