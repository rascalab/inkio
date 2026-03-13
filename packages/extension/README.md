# @inkio/extension

[@inkio/editor](https://www.npmjs.com/package/@inkio/editor)를 위한 확장 익스텐션 패키지. @멘션, #해시태그, /슬래시 커맨드, 콜아웃, 위키 링크, 이미지 블록, 댓글, 북마크, 수식, 토글 리스트, 심플 테이블을 지원합니다.

문서: https://rascalab.github.io/inkio/

## Features

- **Mention** — `@` 트리거로 사용자 멘션
- **HashTag** — `#` 트리거로 해시태그
- **SlashCommand** — `/` 트리거로 블록 삽입 커맨드
- **Callout** — info, warning, tip, danger, note 콜아웃 블록
- **WikiLink** — `[[page]]` 형식의 내부 링크
- **ImageBlock** — 이미지 업로드 + 편집 (crop, markup, Konva 기반)
- **Comment** — 인라인 댓글 + CommentPanel / CommentComposer UI
- **BlockHandle** — 드래그 핸들 + 블록 액션 메뉴
- **Bookmark** — URL 북마크 카드
- **EquationBlock / EquationInline** — 수식 블록/인라인
- **ToggleList** — 접기/펼치기 리스트
- **SimpleTable** — 심플 테이블
- **KeyboardShortcuts** — 추가 키보드 단축키
- Tree-shakable 서브패스 import 지원

## Install

```bash
npm install @inkio/editor @inkio/extension react react-dom
# or
pnpm add @inkio/editor @inkio/extension react react-dom
```

Peer dependencies:
- `@inkio/editor` ^0.0.3
- `react` ^18.0.0 || ^19.0.0, `react-dom` ^18.0.0 || ^19.0.0

내부 의존성(별도 설치 불필요):
- `katex`, `konva`, `react-konva`
- `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/suggestion`
- `@tiptap/extension-table`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-table-row`

## Quick Start

가장 간단한 방법은 `getDefaultInkioExtensions()`를 사용하는 것입니다.

```tsx
import { Editor } from '@inkio/editor';
import { getDefaultInkioExtensions } from '@inkio/extension';
import '@inkio/editor/minimal.css';
import '@inkio/extension/style.css';

const extensions = getDefaultInkioExtensions({
  placeholder: 'Write something...',
  blockHandle: true,
  locale: 'en-US,en;q=0.9',
});

export function MyEditor() {
  return <Editor extensions={extensions} showBubbleMenu showFloatingMenu />;
}
```

`getDefaultInkioExtensions()`는 full preset입니다. 빠른 프로토타이핑에는 좋지만, 번들 크기가 중요하면 아래처럼 `getDefaultCoreExtensions()`와 필요한 서브패스 import를 조합하는 방식을 권장합니다.

```tsx
import { Editor, getDefaultCoreExtensions } from '@inkio/editor';
import { BlockHandle } from '@inkio/extension/block-handle';
import { Callout } from '@inkio/extension/callout';
import { HashTag } from '@inkio/extension/hashtag';
import { SlashCommand } from '@inkio/extension/slash-command';
import { WikiLink } from '@inkio/extension/wikilink';
import '@inkio/editor/minimal.css';
import '@inkio/extension/style.css';

const tags = ['inkio', 'editor', 'react'];

const extensions = [
  ...getDefaultCoreExtensions({
    placeholder: 'Write something...',
  }),
  Callout,
  HashTag.configure({
    items: ({ query }) =>
      tags
        .filter((tag) => tag.includes(query.toLowerCase()))
        .map((tag) => ({ id: tag, label: `#${tag}` })),
  }),
  SlashCommand,
  WikiLink,
  BlockHandle,
];

export function MyEditor() {
  return <Editor extensions={extensions} showBubbleMenu showFloatingMenu />;
}
```

> `HashTag`는 `#`와 heading markdown shortcut이 충돌할 수 있어 기본 preset에서 opt-in입니다.
> `ImageBlock`은 `@inkio/editor`에 구현되어 있고 `@inkio/extension`에서는 하위 호환용으로 re-export됩니다.

## Tree-Shakable Imports

전체 import 또는 개별 서브패스 import를 사용할 수 있습니다.

```tsx
// 전체 import
import { Mention, HashTag } from '@inkio/extension';

// 서브패스 import (필요한 것만 번들에 포함)
import { Mention } from '@inkio/extension/mention';
import { HashTag } from '@inkio/extension/hashtag';
import { SlashCommand } from '@inkio/extension/slash-command';
import { WikiLink } from '@inkio/extension/wikilink';
import { Callout } from '@inkio/extension/callout';
import { BlockHandle } from '@inkio/extension/block-handle';
import { CommentPanel } from '@inkio/extension/comment';
import { ImageBlock } from '@inkio/editor';
```

## Extensions

### Mention

`@` 입력으로 사용자 멘션을 트리거합니다.

```tsx
import { Mention } from '@inkio/extension/mention';

const mention = Mention.configure({
  suggestion: {
    items: async ({ query }) => {
      // 사용자 목록 반환
      return users.filter((user) =>
        user.name.toLowerCase().includes(query.toLowerCase())
      );
    },
  },
});
```

### HashTag

`#` 입력으로 해시태그를 트리거합니다.

```tsx
import { HashTag } from '@inkio/extension/hashtag';

const hashtag = HashTag.configure({
  suggestion: {
    items: async ({ query }) => {
      return tags.filter((tag) =>
        tag.name.toLowerCase().includes(query.toLowerCase())
      );
    },
  },
});
```

### SlashCommand

`/` 입력으로 블록 삽입 커맨드 메뉴를 표시합니다.

```tsx
import { SlashCommand } from '@inkio/extension/slash-command';
```

기본 커맨드: Heading 1~3, Bullet List, Ordered List, Task List, Blockquote, Code Block, Horizontal Rule, Callout 등

### Callout

정보, 경고, 팁 등의 강조 블록을 삽입합니다.

```tsx
import { Callout } from '@inkio/extension/callout';
```

에디터에서 `::info`, `::warning`, `::tip`, `::danger`, `::note`를 입력하면 해당 콜아웃 블록이 생성됩니다.

### WikiLink

`[[page name]]` 형식으로 내부 링크를 생성합니다.

```tsx
import { WikiLink } from '@inkio/extension/wikilink';

const wikiLink = WikiLink.configure({
  onClick: (pageName: string) => {
    router.push(`/wiki/${pageName}`);
  },
});
```

### ImageBlock

이미지 업로드와 인라인 편집(Konva 기반 crop, markup)을 지원합니다.

```tsx
import { ImageBlock } from '@inkio/editor';
import '@inkio/extension/style.css';

const imageBlock = ImageBlock.configure({
  onUpload: async (file: File) => {
    const url = await uploadToStorage(file);
    return url;
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
});
```

> `ImageBlock`은 `@inkio/editor`에서 직접 import하는 것을 권장합니다. `@inkio/extension/image`는 `ImageEditorModal`과 하위 호환용 re-export를 제공합니다.
> `onUpload` 핸들러가 없으면 이미지가 base64 data URL로 삽입됩니다.

### Comment

인라인 댓글 마크와 댓글 패널 UI를 제공합니다.

```tsx
import { CommentPanel, CommentComposer } from '@inkio/extension/comment';
```

`getDefaultInkioExtensions({ comment: { ... } })`으로 Comment 익스텐션을 활성화하고, `CommentPanel`을 에디터 옆에 렌더링합니다.

### BlockHandle

드래그 핸들과 블록 액션 메뉴입니다.

```tsx
import { BlockHandle } from '@inkio/extension/block-handle';
```

`getDefaultInkioExtensions({ blockHandle: true })`로 활성화하는 것을 권장합니다.

### ImageEditorModal

이미지 편집 모달 컴포넌트를 직접 사용할 수도 있습니다.

```tsx
import { ImageEditorModal } from '@inkio/extension/image';
```

## CSS

확장 노드 스타일과 이미지 편집 스타일을 import해야 합니다.

```tsx
import '@inkio/extension/style.css';
```

`SlashCommand`, `HashTag`, `Comment`, `BlockHandle`, `ImageEditorModal` 같은 확장 UI를 쓸 때 필수입니다.

## Exports

| Sub-path | Exports |
|---|---|
| `@inkio/extension` | 전체: `getDefaultInkioExtensions`, `Mention`, `HashTag`, `SlashCommand`, `Callout`, `WikiLink`, `ImageBlock`, `ImageEditorModal`, `Comment`, `CommentPanel`, `CommentComposer`, `BlockHandle`, `Bookmark`, `EquationBlock`, `EquationInline`, `ToggleList`, `SimpleTable`, `KeyboardShortcuts`, `extractMentions`, `extractHashtags`, adapter exports |
| `@inkio/extension/mention` | `Mention` |
| `@inkio/extension/hashtag` | `HashTag` |
| `@inkio/extension/slash-command` | `SlashCommand` |
| `@inkio/extension/wikilink` | `WikiLink` |
| `@inkio/extension/callout` | `Callout` |
| `@inkio/extension/block-handle` | `BlockHandle`, `BlockHandleActionMenu`, `blockHandlePluginKey` |
| `@inkio/extension/bookmark` | `Bookmark` |
| `@inkio/extension/comment` | `Comment`, `CommentPanel`, `CommentComposer`, `CommentThreadPopover` |
| `@inkio/extension/equation` | `EquationBlock`, `EquationInline` |
| `@inkio/extension/image` | `ImageBlock`, `ImageEditorModal` |
| `@inkio/extension/keyboard-shortcuts` | `KeyboardShortcuts` |
| `@inkio/extension/simple-table` | `SimpleTable` |
| `@inkio/extension/toggle-list` | `ToggleList` |
| `@inkio/extension/style.css` | 확장 노드 + 이미지 에디터 스타일 |

## Packages

| Package | Description |
|---|---|
| [`@inkio/editor`](https://www.npmjs.com/package/@inkio/editor) | 에디터/뷰어 코어 |
| [`@inkio/extension`](https://www.npmjs.com/package/@inkio/extension) | 확장 익스텐션 |
| [`@inkio/server`](https://www.npmjs.com/package/@inkio/server) | 서버사이드 유틸리티 |

## License

MIT
