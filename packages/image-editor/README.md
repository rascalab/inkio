# @inkio/image-editor

Optional image editing UI for Inkio `ImageBlock`.

## Install

```bash
npm install @inkio/image-editor @inkio/core react react-dom
```

Use `ImageEditor` on its own or connect `ImageEditorModal` to `imageBlock.imageEditor`. Neither component requires loading a document editor.

## Usage

With `@inkio/editor` (install the preset separately):

```tsx
import { Editor } from '@inkio/editor';
import { ImageEditorModal } from '@inkio/image-editor';
import '@inkio/editor/style.css';
import '@inkio/image-editor/style.css';

export function EditorWithImages({ upload }: { upload: NonNullable<React.ComponentProps<typeof Editor>['onImageUpload']> }) {
  return (
    <Editor
      onImageUpload={upload}
      imageBlock={{ imageEditor: ImageEditorModal }}
    />
  );
}
```

Supply an upload handler that returns a persistent image URL and forwards `context.signal` to the request. Without a handler, edited images are saved as data URLs. For `@inkio/simple`, use the same props and import `Editor` and `style.css` from that preset instead.

## Standalone editing

Import `@inkio/core/minimal.css` before `@inkio/image-editor/style.css`. Mount the inline editor inside a themed `.inkio` element with a height; the modal creates its own portal wrapper.

```tsx
import { ImageEditor, type ImageEditorProps } from '@inkio/image-editor';
import '@inkio/core/minimal.css';
import '@inkio/image-editor/style.css';

export function InlineImage(props: ImageEditorProps) {
  return <div className="inkio light" style={{ height: 480 }}><ImageEditor {...props} /></div>;
}
```

Use `outputFormat` / `outputQuality` inline or `imageFormat` / `imageQuality` on the modal. Formats are `'png'` (default), `'jpeg'`, and `'webp'`; quality defaults to `0.92` and does not affect PNG. `onSave` is required. If you also supply `onSaveBlob`, it receives the encoded Blob instead of calling `onSave`; set `savePreview` to request a display-sized Blob as its second argument. On the modal, handle closing in `onClose`, which runs after a successful save or a save without edits.

## Migrating locale overrides

Remove `editCrop`, `doneCropping`, `customColor`, `fontFamilyPlaceholder`, `smallViewportTitle`, and `smallViewportBody` from image-editor locale and message overrides. These labels were no longer rendered and have no replacement: cropping is part of Resize, color and font selection use pickers, and narrow viewports scroll instead of blocking editing. The `'crop'` tool ID still works as an alias for `'resize'`.
