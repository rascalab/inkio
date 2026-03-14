# @inkio/image-editor

Optional image editing UI for Inkio `ImageBlock`.

## Install

```bash
npm install @inkio/image-editor react react-dom
```

Use this only when you wire `imageBlock.imageEditor` to `ImageEditorModal`.

## Usage

With `@inkio/editor`:

```tsx
import { Editor } from '@inkio/editor';
import { ImageEditorModal } from '@inkio/image-editor';
import '@inkio/image-editor/style.css';

export function EditorWithImages() {
  return (
    <Editor
      defaultExtensionsOptions={{
        imageBlock: {
          onUpload: async (file) => URL.createObjectURL(file),
          imageEditor: ImageEditorModal,
        },
      }}
    />
  );
}
```

With `@inkio/simple`:

```tsx
import { Editor } from '@inkio/simple';
import { ImageEditorModal } from '@inkio/image-editor';
import '@inkio/image-editor/style.css';

export function SimpleWithImages() {
  return (
    <Editor
      defaultExtensionsOptions={{
        imageBlock: {
          onUpload: async (file) => URL.createObjectURL(file),
          imageEditor: ImageEditorModal,
        },
      }}
    />
  );
}
```
