# @inkio/essential

Markdown-friendly document extensions for Inkio.

## Includes

- `Callout`
- details/toggle support
- table support
- keyboard shortcuts

## Exports

- `getDefaultExtensions(options?)`
- `Callout`
- `KeyboardShortcuts`
- `@inkio/essential/callout`
- `@inkio/essential/keyboard-shortcuts`
- `@inkio/essential/style.css`

## Install

```bash
npm install @inkio/essential react react-dom
```

Normally you do not install this directly unless you are composing with `@inkio/core`.

## Usage

```tsx
import { Editor } from '@inkio/core';
import { getDefaultExtensions } from '@inkio/essential';
import '@inkio/core/minimal.css';
import '@inkio/essential/style.css';

export function EssentialEditor() {
  return (
    <Editor
      initialContent="<p>Hello Inkio</p>"
      extensions={getDefaultExtensions({
        table: true,
        toggleList: true,
      })}
    />
  );
}
```
