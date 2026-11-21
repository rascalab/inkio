import type { EditorView } from '@tiptap/pm/view';
import { dropMarkerRect } from './block-drop';
import { createBlockDragPreview } from './drag-preview';

export const syncTheme = (element: HTMLElement, editorDom: HTMLElement) => {
  const scope = editorDom.closest('.inkio') ?? editorDom;
  const light = scope.classList.contains('light');
  element.classList.toggle('light', light);
  element.classList.toggle('dark', !light && Boolean(scope.closest('.dark, .dark-theme')));
};

export type BlockDragVisuals = ReturnType<typeof createBlockDragVisuals>;

export const createBlockDragVisuals = (view: EditorView) => {
  const doc = view.dom.ownerDocument;
  let marker: HTMLDivElement | null = null;
  let preview: HTMLDivElement | null = null;

  const clearMarker = () => {
    marker?.remove();
    marker = null;
  };

  return {
    mountPreview(source: HTMLElement, mode: 'native' | 'touch') {
      preview = createBlockDragPreview(source, mode);
      syncTheme(preview, view.dom);
      doc.body.appendChild(preview);
      return preview;
    },
    clearPreview() {
      preview?.remove();
      preview = null;
    },
    showMarker(gap: number | null) {
      const rect = gap === null ? null : dropMarkerRect(view, gap);
      if (!rect) {
        clearMarker();
        return;
      }
      if (!marker) {
        marker = doc.createElement('div');
        marker.className = 'inkio inkio-block-drop-marker';
        marker.setAttribute('aria-hidden', 'true');
        syncTheme(marker, view.dom);
        doc.body.appendChild(marker);
      }
      marker.style.left = `${rect.left}px`;
      marker.style.top = `${rect.top}px`;
      marker.style.width = `${rect.width}px`;
    },
    clearMarker,
    syncTheme() {
      if (marker) syncTheme(marker, view.dom);
      if (preview) syncTheme(preview, view.dom);
    },
  };
};
