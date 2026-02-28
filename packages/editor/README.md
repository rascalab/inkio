# @inkio/editor

Tiptap v3 기반 React 리치 텍스트 에디터 라이브러리. 조합 가능한 컴포넌트와 훅으로 에디터를 자유롭게 구성할 수 있습니다.

문서: https://rascalab.github.io/inkio/

## Features

- **Editor** / **Viewer** 컴포넌트 (Controlled & Uncontrolled)
- **BubbleMenu**, **FloatingMenu** 조합형 UI (`showBubbleMenu` / `showFloatingMenu` props)
- **useInkioEditor** 훅으로 에디터 인스턴스 직접 제어
- **25+ 기본 익스텐션** 내장 (Heading, List, TaskList, CodeBlock, Link, Highlight 등)
- **SSR 안전** (`immediatelyRender: false`)
- ESM + CJS 지원, TypeScript 타입 포함

## Install

```bash
npm install @inkio/editor
# or
pnpm add @inkio/editor
```

Peer dependencies: `react` ^18.0.0 || ^19.0.0, `react-dom` ^18.0.0 || ^19.0.0

> Tiptap 런타임 의존성이 포함되어 있어 `@tiptap/*`를 별도 설치할 필요가 없습니다.
> 확장 전용 adapter/serialization/comment UI는 `@inkio/extension`에서 제공합니다.

## Quick Start

```tsx
import { Editor } from '@inkio/editor';
import '@inkio/editor/minimal.css';

export function MyEditor() {
  return (
    <Editor
      showBubbleMenu
      showFloatingMenu
      onUpdate={(json) => console.log(json)}
    />
  );
}
```

## Controlled / Uncontrolled

```tsx
// Controlled - 외부 상태로 content 관리
<Editor content={content} onUpdate={setContent} />

// Uncontrolled - 초기값만 전달
<Editor initialContent={initialContent} onUpdate={setContent} />
```

`content`와 `initialContent`는 동시에 사용할 수 없습니다.

## Viewer (읽기 전용)

```tsx
import { Viewer } from '@inkio/editor';
import '@inkio/editor/minimal.css';

<Viewer content={savedContent} />
```

## BubbleMenu & FloatingMenu

`<Editor>`는 기본적으로 UI가 없는 헤드리스 컴포넌트입니다. `showBubbleMenu` / `showFloatingMenu` props로 내장 메뉴를 활성화하거나, `BubbleMenu` / `FloatingMenu` 컴포넌트를 직접 조합할 수 있습니다.

```tsx
import { Editor, BubbleMenu, FloatingMenu } from '@inkio/editor';

function MyEditor() {
  const [editor, setEditor] = useState(null);

  return (
    <>
      {editor && <BubbleMenu editor={editor} />}
      {editor && <FloatingMenu editor={editor} />}
      <Editor onCreate={setEditor} />
    </>
  );
}
```

또는 props로 간편하게 활성화:

```tsx
<Editor showBubbleMenu showFloatingMenu />
```

## useInkioEditor Hook

에디터 인스턴스를 직접 제어할 때 사용합니다.

```tsx
import { useInkioEditor } from '@inkio/editor';

const editor = useInkioEditor({
  content: '<p>Hello</p>',
  onUpdate: (json) => console.log(json),
});
```

## Custom Extensions

기본 익스텐션 위에 커스텀 익스텐션을 추가할 수 있습니다.

```tsx
import { Editor, getDefaultCoreExtensions } from '@inkio/editor';

const extensions = [
  ...getDefaultCoreExtensions({ placeholder: 'Write...' }),
  // add your custom extensions here
];

<Editor extensions={extensions} />
```

확장 익스텐션은 [`@inkio/extension`](https://www.npmjs.com/package/@inkio/extension) 패키지를 참고하세요.
멘션/해시태그 추출 유틸(`extractMentions`, `extractHashtags`)도 `@inkio/extension`에서 제공합니다.

## CSS

2가지 스타일 진입점을 제공합니다.

```tsx
// 풀 스타일 (토큰 + 디자인 + UI 컴포넌트)
import '@inkio/editor/style.css';

// 미니멀 스타일 (토큰 + 구조만, 커스텀 디자인용)
import '@inkio/editor/minimal.css';
```

## Next.js (App Router)

SSR 환경에서는 클라이언트 컴포넌트로 사용해야 합니다.

```tsx
'use client';

import { Editor } from '@inkio/editor';
import '@inkio/editor/minimal.css';
```

또는 dynamic import를 사용할 수 있습니다.

```tsx
import dynamic from 'next/dynamic';

const Editor = dynamic(
  () => import('@inkio/editor').then((mod) => mod.Editor),
  { ssr: false }
);
```

## API

### Components

| Component | Description |
|---|---|
| `Editor` | 리치 텍스트 에디터 (BubbleMenu/FloatingMenu 내장 활성화 지원) |
| `Viewer` | 읽기 전용 뷰어 |
| `BubbleMenu` | 선택 영역 위 팝업 메뉴 |
| `FloatingMenu` | 빈 줄에 표시되는 플로팅 메뉴 |

### Hooks

| Hook | Description |
|---|---|
| `useInkioEditor` | 에디터 인스턴스 생성 훅 |

### Utilities

| Function | Description |
|---|---|
| `getDefaultCoreExtensions()` | 기본 25+ 익스텐션 세트 반환 |
| `createSuggestionRenderer()` | Suggestion UI 렌더러 생성 |
| `createInkioExtensionRegistry()` | 익스텐션 레지스트리 생성 |

## Packages

| Package | Description |
|---|---|
| [`@inkio/editor`](https://www.npmjs.com/package/@inkio/editor) | 에디터/뷰어 코어 |
| [`@inkio/extension`](https://www.npmjs.com/package/@inkio/extension) | Mention, HashTag, SlashCommand, Callout, WikiLink, ImageBlock, Comment, BlockHandle 등 |
| [`@inkio/server`](https://www.npmjs.com/package/@inkio/server) | 서버사이드 유틸리티 |

## License

MIT
