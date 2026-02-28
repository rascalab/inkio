# Inkio

Inkio is a Tiptap-based rich text editor toolkit split into packages:

- `@inkio/editor`: editor/viewer UI, default core extensions, hooks
- `@inkio/extension`: feature extensions (mention, hashtag, slash, callout, wiki link, image block)
- `@inkio/server`: server-side conversion adapter surface (phase 2)

Docs: https://rascalab.github.io/inkio/

## Install

```bash
npm install @inkio/editor @inkio/extension react react-dom
```

`@inkio/editor`의 필수 peer dependency는 `react`, `react-dom`입니다.  
`@inkio/extension`는 `@inkio/editor`, `react`, `react-dom`을 peer로 요구합니다.  
Tiptap 런타임(`@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/suggestion`, table 계열)과 `katex`, `konva`, `react-konva`는 `@inkio/extension` 내부 의존성으로 포함됩니다.

## Start Here

- `examples/basic-react`: Vite + React에서 `@inkio/editor`만 쓰는 가장 작은 시작점
- `examples/next-app-router`: Next.js App Router에서 `@inkio/editor` + `@inkio/extension`를 함께 쓰는 기준 예제
- `AI_CONTEXT.md`: AI에게 함께 주기 좋은 한 장짜리 요약 컨텍스트

로컬에서 바로 실행:

```bash
pnpm install
pnpm --filter example-basic-react dev
# or
pnpm --filter example-next-app-router dev
```

## Quick Start

```tsx
import { Editor, getDefaultCoreExtensions } from '@inkio/editor';
import { ImageBlock, Mention, HashTag, SlashCommand, Callout, WikiLink } from '@inkio/extension';
import '@inkio/editor/minimal.css';
import '@inkio/extension/style.css';

const extensions = [
  ...getDefaultCoreExtensions({ placeholder: 'Write something...' }),
  ImageBlock,
  Mention,
  HashTag,
  SlashCommand,
  Callout,
  WikiLink,
];

export function MyEditor() {
  return <Editor extensions={extensions} />;
}
```

## Using With AI

AI에게 Inkio 코드를 시킬 때는 설명만 주기보다 `가장 가까운 예제 파일 + AI_CONTEXT.md`를 같이 주는 방식이 제일 안정적입니다.

추천 방식:

1. `core`만 필요하면 `examples/basic-react`를 기준으로 시작
2. Next.js App Router나 확장 기능이 필요하면 `examples/next-app-router`를 기준으로 시작
3. 프롬프트에 아래 3가지를 같이 적기
   - 사용하는 런타임: `React/Vite` 또는 `Next App Router`
   - 필요한 기능: `core only` 또는 `extensions`
   - 추가 요구사항: `upload`, `comment`, `wikilink`, `custom toolbar` 등

AI에게 같이 주면 좋은 파일:

- `AI_CONTEXT.md`
- `examples/basic-react/src/App.tsx`
- `examples/next-app-router/components/editor-demo.tsx`

AI가 자주 놓치는 규칙:

- `@inkio/extension`를 쓸 때는 `@inkio/extension/style.css`를 같이 import해야 합니다.
- `@inkio/extension`는 `katex`, `konva`, `react-konva`를 내부 의존성으로 포함하므로 별도 설치가 필요 없습니다.
- Next.js App Router에서는 에디터를 반드시 `use client` 컴포넌트 안에서 렌더링해야 합니다.
- `content`와 `initialContent`는 동시에 쓰지 않습니다.

## Controlled / Uncontrolled

```tsx
import { Editor } from '@inkio/editor';

// controlled
<Editor content={content} onUpdate={setContent} />

// uncontrolled
<Editor initialContent={initialContent} onUpdate={setContent} />
```

`content` and `initialContent` are mutually exclusive.

## Tree-shakable extension imports

```tsx
import { Mention } from '@inkio/extension';
// or
import { Mention } from '@inkio/extension/mention';
```

## Examples

- `examples/basic-react`: core-only Vite example
- `examples/next-app-router`: Next App Router + extensions example
- `AI_CONTEXT.md`: AI-oriented integration guide

## Packages

| Package | Description |
|---|---|
| [`@inkio/editor`](https://www.npmjs.com/package/@inkio/editor) | 에디터/뷰어 코어 |
| [`@inkio/extension`](https://www.npmjs.com/package/@inkio/extension) | Mention, HashTag, SlashCommand, Callout, WikiLink, ImageBlock |
| [`@inkio/server`](https://www.npmjs.com/package/@inkio/server) | 서버사이드 유틸리티 |

## License

MIT
