# @inkio/simple

Classic WYSIWYG Inkio entry point.

## Defaults

- based on `@inkio/core`
- toolbar on
- bubble menu off
- floating menu off

## Install

```bash
npm install @inkio/simple react react-dom
```

## Usage

```tsx
import { Editor } from '@inkio/simple';
import '@inkio/simple/style.css';

export function SimplePage() {
  return <Editor content="<p>Hello Inkio</p>" />;
}
```

## Viewer

```tsx
import { Viewer } from '@inkio/simple';

<Viewer content={content} />;
```

목차는 에디터나 프리셋 Viewer의 `onCreate` 인스턴스를 `<ToC source={editor} />`에 전달하세요.
인터랙션 없이 읽기만 한다면 `@inkio/core/static`의 `StaticViewer`를 사용할 수 있습니다.
`ToC`나 `StaticViewer`를 직접 가져오는 앱은 `@inkio/core`도 직접 의존성에 추가하세요.

`@inkio/simple`도 SSR 환경에서 초기 문서 HTML을 먼저 렌더하고, hydration 이후에 toolbar-first interactive editor로 이어지는 계약을 사용합니다.

## Saved JSON

Import `read` from `@inkio/simple` to read saved content without mounting an editor. For example, `read(json).summary(80)` returns a preview of at most 80 UTF-16 code units, including the ellipsis. Reuse the reader for the same immutable JSON; create another for a changed document.

## Markdown

```tsx
import { parseMarkdown, stringifyMarkdown } from '@inkio/simple/markdown';
```

The adapter is implemented in `@inkio/core/markdown` with `remark/unified` and re-exported here.
