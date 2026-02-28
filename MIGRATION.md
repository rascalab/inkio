# Migration Guide

## Package split

- `inkio` -> `@inkio/editor` + `@inkio/extension`

## Dependency contract changes (breaking)

- `@inkio/editor`의 `peerDependencies`는 `react`, `react-dom`만 유지합니다.
- `@inkio/extension`는 `@inkio/editor`, `react`, `react-dom`을 `peerDependencies`로 요구합니다.
- Tiptap 런타임(`@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/suggestion`, table 계열)은 `@inkio/extension` `dependencies`로 제공합니다.
- 기존 core에서 제공하던 확장 전용 adapter/serialization/comment UI API는 `@inkio/extension`로 이동했습니다.

즉 일반 소비자는 아래를 함께 설치해야 합니다.

```bash
npm install @inkio/editor @inkio/extension react react-dom
```

## Import mapping

- `import { Editor, Viewer } from 'inkio'`
  -> `import { Editor, Viewer } from '@inkio/editor'`

- `import { Mention } from 'inkio'`
  -> `import { Mention } from '@inkio/extension'`
  -> or `import { Mention } from '@inkio/extension/mention'`

- `import 'inkio/style-core.css'`
  -> `import '@inkio/editor/minimal.css'`

- `import 'inkio/style-full.css'`
  -> `import '@inkio/editor/style.css'`

- `import 'inkio/style-image-editor.css'`
  -> `import '@inkio/extension/style.css'`

- `import 'inkio/style-extensions.css'` (new)
  -> `import '@inkio/extension/style.css'`

## Class name mapping (breaking)

- `tiptap-editor-container` -> `inkio-editor-container`
- `tiptap-viewer-container` -> `inkio-viewer-container`
- `tiptap-editor-with-toolbar` -> `inkio-editor-with-toolbar`
- `tiptap-toolbar-wrapper` -> `inkio-toolbar-wrapper`
- `tiptap-editor-wrapper` -> `inkio-editor-wrapper`

하위 호환 alias는 제공하지 않습니다.

## Default extensions API

- `getDefaultExtensions` / `getDefaultEditorExtensions` (old)
- `getDefaultCoreExtensions` from `@inkio/editor` (new)
- `getDefaultInkioExtensions` from `@inkio/extension` (new)
- `extractMentions` / `extractHashtags` from `@inkio/editor` (old)
  -> `extractMentions` / `extractHashtags` from `@inkio/extension` (new)

## Editor state model

`Editor` supports:

- controlled: `content + onUpdate`
- uncontrolled: `initialContent (+ onUpdate)`

Passing both `content` and `initialContent` throws at runtime.

## UX 리빌드 v3 (breaking)

### i18n 입력 통합

- `acceptLanguage` 스타일 별도 prop은 제공하지 않습니다.
- 국제화 입력은 `locale?: unknown` 단일 prop으로 통합됩니다.
- `locale`은 문자열/Accept-Language/배열/`Intl.Locale`/locale-like 객체를 해석합니다.

### 메시지 전략 변경

- 기본 내장 메시지는 영어(`en`)만 제공합니다.
- 다국어 메시지는 소비자가 `messages` prop으로 주입해야 합니다.

신규 export:

- `enCoreMessages` (`@inkio/editor`)
- `enExtensionsMessages` (`@inkio/extension`)
- `resolveLocaleInput`, `pickMessageLocale` (`@inkio/editor`)

### Provider/컴포넌트 props 확장

`InkioProviderProps`:
- `locale?: unknown`
- `messages?: InkioMessageOverrides`
- `icons?: Partial<InkioIconRegistry>`

주요 UI 컴포넌트(`EditorWithToolbar`, `Toolbar`, `BubbleMenu`, `FloatingMenu`, `SuggestionList`, `CommentPanel`, `CommentComposer`, `ImageEditorModal`)도 동일 override를 지원합니다.

### 아이콘/툴바 단일 레지스트리

신규 export (`@inkio/editor`):

- `inkioToolbarSchema`
- `inkioIconRegistry`
- `InkioToolbarActionId`
- `InkioIconId`

### 레거시 Comment export 제거

- `CommentSidebar` 제거
- `CommentPopover` 제거

### BlockHandle 기본 메뉴 동작 변경

- `blockHandle: true` 시 기본 액션 메뉴가 자동 연결됩니다.
- 기존 `inkio:block-menu` 커스텀 이벤트는 하위 호환으로 계속 발행됩니다.
