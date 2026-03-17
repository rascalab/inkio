# Editor DX Simplification Design

## Goal

라이브러리를 처음 쓰는 개발자가 5분 안에 원하는 구성을 만들 수 있도록, `@inkio/simple`과 `@inkio/editor`의 public API 표면을 단순화한다.

## Scope

- API 표면 정리 (패키지 구조는 유지)
- `@inkio/simple`: 기본 에디터 진입점
- `@inkio/editor`: 풀 기능 에디터 진입점
- `Viewer` 컴포넌트도 동일한 원칙 적용
- 커스텀 extension 추가를 쉽게

## Non-Goals

- 패키지 구조 재설계 (core/essential/advanced 내부 레이어 유지)
- 기존 사용자 마이그레이션 (기존 사용자 없음)

---

## 1. `extensions` Prop 동작 변경

### 현재 문제

`extensions` prop을 넘기면 기본 extension을 완전히 교체한다. 커스텀 extension 하나를 추가하려면 `getDefaultExtensions()` 호출 후 spread해야 하는데, 이는 유저 기대와 맞지 않는다.

### 변경

`extensions` prop 타입을 union으로 변경:

```ts
type ExtensionsInput =
  | Extension[]                                    // additive (shorthand)
  | { items: Extension[]; replace?: boolean }      // configurable
```

- **배열**: 기본 extension에 추가 (additive)
- **object + `replace: true`**: 기본 extension 무시, items만 사용

### 중복 해결 전략 (Deduplication)

additive 모드에서 유저가 넘긴 extension이 기본 extension과 같은 `name`을 가지면, **유저 것이 기본 것을 교체**한다. 이를 통해 built-in extension을 커스텀 설정으로 오버라이드할 수 있다.

```ts
function mergeExtensions(defaults: Extension[], userExtensions: Extension[]): Extension[] {
  const userNames = new Set(userExtensions.map(ext => ext.name));
  const filtered = defaults.filter(ext => !userNames.has(ext.name));
  return [...filtered, ...userExtensions];
}
```

### 사용 예시

```tsx
// 추가 (대부분의 경우)
<Editor extensions={[MyCustomExtension]} />

// 기본 extension 오버라이드 (같은 name이면 교체)
<Editor extensions={[Mention.configure({ customOption: true })]} />

// 전체 교체 (고급)
<Editor extensions={{ items: [MyCustomExtension], replace: true }} />
```

---

## 2. Props 표면 재설계

### 원칙

- 자주 쓰는 설정은 **flat prop** (placeholder, locale)
- UI/스타일 설정은 **`ui` object**로 그룹화
- 기능 콜백은 **flat prop** - 제공하면 해당 기능 활성화
- 여러 옵션이 묶이는 복합 기능은 **named prop (object)**
- `defaultExtensionsOptions` bag 제거

### `@inkio/editor` EditorProps

```ts
type ImageUploadResult = string | { src: string; [key: string]: unknown };

interface EditorProps {
  // --- 콘텐츠 (기존 유지) ---
  initialContent?: string | JSONContent;
  content?: string | JSONContent;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
  editable?: boolean;

  // --- 에디터 기본 (flat - 거의 모든 유저가 씀) ---
  placeholder?: string;
  locale?: InkioLocaleInput;
  tabBehavior?: 'indent' | 'default';

  // --- UI 설정 (object) ---
  ui?: {
    // 레이아웃/스타일
    className?: string;
    style?: React.CSSProperties;
    fill?: boolean;
    bordered?: boolean;
    // 메뉴 표시
    showToolbar?: boolean;
    showBubbleMenu?: boolean;
    showFloatingMenu?: boolean;
    showTableMenu?: boolean;
    // 메뉴 세부 설정 (고급)
    toolbar?: Omit<ToolbarProps, 'editor'>;
    bubbleMenu?: Omit<BubbleMenuProps, 'editor'>;
    floatingMenu?: Omit<FloatingMenuProps, 'editor'>;
    tableMenu?: Omit<TableMenuProps, 'editor'>;
    // i18n/테마
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };

  // --- 기능 콜백 (flat - 제공하면 활성화) ---
  onImageUpload?: (file: File) => Promise<ImageUploadResult>;
  hashtagItems?: (params: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  mentionItems?: (params: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  transformSlashCommands?: SlashCommandTransform;
  onWikiLinkClick?: (href: string) => void;
  onError?: InkioErrorHandler;

  // --- 복합 기능 (named prop - object로 제공하면 활성화) ---
  comment?: false | CommentConfig;
  imageBlock?: Omit<Partial<ImageBlockOptions>, 'onUpload' | 'HTMLAttributes'>;
  bookmark?: false | { onResolveBookmark?: (url: string) => Promise<BookmarkPreview> };

  // --- Feature toggles (기본 ON, false로 비활성화) ---
  blockHandle?: boolean;   // default: true
  wikiLink?: boolean;      // default: true
  table?: boolean;         // default: true
  callout?: boolean;       // default: true
  toggleList?: boolean;    // default: true

  // --- 확장 ---
  extensions?: ExtensionsInput;
}
```

> **`onImageUpload` vs `imageBlock`**: `onImageUpload`는 가장 흔한 케이스(업로드 핸들러만 제공)의 shorthand. `imageBlock`은 `allowedMimeTypes`, `maxFileSize`, `imageEditor` 등 세부 설정이 필요할 때 사용. `onImageUpload`를 제공하면 내부적으로 `imageBlock.onUpload`로 매핑된다. 둘 다 제공하면 `onImageUpload`가 우선.

> **`comment` prop**: 새로운 `CommentConfig` 인터페이스. 기존 `CommentOptions`에서 네이밍을 정리하고 불필요한 필드를 제거:
>
> ```ts
> interface CommentConfig {
>   onSubmit?: (commentId: string, text: string, selection: string) => void;
>   onReply?: (commentId: string, text: string) => void;
>   onResolve?: (commentId: string) => void;
>   onUnresolve?: (commentId: string) => void;
>   onDelete?: (commentId: string) => void;
>   getComments?: (commentId: string) => CommentData | null;
>   generateId?: () => string;
> }
> ```
>
> 변경 사항:
> - `onCommentSubmit` → `onSubmit` (이미 `comment.` 네임스페이스 안)
> - `onCommentReply` → `onReply`
> - `onCommentResolve` → `onResolve`
> - `onCommentDelete` → `onDelete`
> - `getThread` → `getComments`, `CommentThreadData` → `CommentData`
> - `threadId` → `commentId` (모든 파라미터)
> - `currentUser` 제거 (서버에서 처리할 영역)
> - `HTMLAttributes`, `locale`, `messages`, `icons` 제거 (Editor의 `ui` prop으로 통합)

> **Feature toggles**: `@inkio/editor`에서 모든 기능은 기본 ON. `false`로 넘기면 해당 extension이 기본 배열에서 제외된다. `@inkio/simple`에서는 이 기능들이 애초에 포함되지 않으므로 토글이 불필요.

### `@inkio/simple` EditorProps

```ts
interface EditorProps {
  // 콘텐츠 (동일)
  initialContent?: string | JSONContent;
  content?: string | JSONContent;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;
  editable?: boolean;

  // 에디터 기본
  placeholder?: string;
  locale?: InkioLocaleInput;
  tabBehavior?: 'indent' | 'default';

  // UI
  ui?: {
    className?: string;
    style?: React.CSSProperties;
    fill?: boolean;
    bordered?: boolean;
    showToolbar?: boolean;
    showBubbleMenu?: boolean;
    showFloatingMenu?: boolean;
    showTableMenu?: boolean;
    toolbar?: Omit<ToolbarProps, 'editor'>;
    bubbleMenu?: Omit<BubbleMenuProps, 'editor'>;
    floatingMenu?: Omit<FloatingMenuProps, 'editor'>;
    tableMenu?: Omit<TableMenuProps, 'editor'>;
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };

  // 기능
  onImageUpload?: (file: File) => Promise<ImageUploadResult>;
  onError?: InkioErrorHandler;

  // 확장
  extensions?: ExtensionsInput;
}
```

### ViewerProps (공통 구조)

```ts
interface ViewerProps {
  // 콘텐츠
  content: string | JSONContent;

  // 기본
  locale?: InkioLocaleInput;

  // UI
  ui?: {
    className?: string;
    style?: React.CSSProperties;
    bordered?: boolean;
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };

  // 목차
  toc?: boolean | {
    position?: 'top' | 'left' | 'right';
    onHeadingsReady?: (headings: HeadingItem[], scrollToIndex: (index: number) => void) => void;
  };

  // 댓글 (읽기 전용 - 팝오버로 스레드 표시)
  comment?: {
    getComments: (commentId: string) => CommentData | null;
    onReply?: (commentId: string, text: string) => void;
    onResolve?: (commentId: string) => void;
  };

  // 확장
  extensions?: ExtensionsInput;
}
```

- `content`만 사용 (`initialContent` 제거 - Viewer는 항상 외부 데이터 기반)
- `toc`: `true`면 기본 위치, object면 세부 설정
- `comment`: `getComments` 필수 (제공하면 comment mark 클릭 시 팝오버 활성화), `onReply`/`onResolve`는 선택적
- `@inkio/simple`과 `@inkio/editor` 모두 동일 구조

### Before / After

```tsx
// ❌ Before
const options = useMemo(() => ({
  placeholder: 'Write...',
  locale: 'ko',
  hashtagItems: ({ query }) => filterTags(query),
  imageBlock: {
    onUpload: async (file) => URL.createObjectURL(file),
    imageEditor: LazyImageEditorModal,
  },
  comment: { currentUser: 'Me', onCommentSubmit: handleSubmit, getThread, ... },
}), [deps]);

<Editor defaultExtensionsOptions={options} showToolbar showBubbleMenu />

// ✅ After
<Editor
  placeholder="Write..."
  locale="ko"
  ui={{ showToolbar: true, showBubbleMenu: true }}
  hashtagItems={({ query }) => filterTags(query)}
  onImageUpload={async (file) => URL.createObjectURL(file)}
  imageBlock={{ imageEditor: LazyImageEditorModal }}
  comment={{ onSubmit: handleSubmit, getComments: fetchComments }}
/>
```

### 가장 단순한 사용

```tsx
import { Editor } from '@inkio/simple';

<Editor placeholder="Write..." onUpdate={handleUpdate} />
```

---

## 3. 제거 대상

| 현재 API | 상태 | 이유 |
|---|---|---|
| `defaultExtensionsOptions` prop | 제거 | flat props + named props로 대체 |
| `extensionRegistry` prop | 제거 | 불필요한 간접층 |
| `InkioExtensionRegistry` type export | 제거 | extensionRegistry와 함께 제거 |
| `adapter` prop | 제거 | 콜백들이 직접 props로 이동 |
| `isInkioAdapter`, `InkioAdapter` exports | 제거 | adapter 패턴 제거에 따라 |
| `getDefaultExtensions` prop (on Editor) | 제거 | 내부 resolution으로 이동 |

> `adapter.ts` 파일 자체는 내부 구현으로 당분간 유지 가능하나, public export에서는 제거한다.

---

## 4. 유지 대상

### `InkioProvider`

역할 축소. 여러 에디터가 같은 설정을 공유할 때만 사용.

```ts
interface InkioProviderProps {
  children: React.ReactNode;
  locale?: InkioLocaleInput;
  ui?: {
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };
}
```

```tsx
<InkioProvider locale="ko" ui={{ messages, icons }}>
  <Editor placeholder="첫번째" />
  <Editor placeholder="두번째" />
</InkioProvider>
```

단일 에디터면 Provider 없이 직접 사용. Provider의 값과 Editor의 값은 shallow merge (Editor 우선). 예: Provider에서 `locale="ko"`, Editor에서 `locale="en"` → `"en"` 적용. `ui` 객체도 shallow merge: Editor의 `ui.messages`가 있으면 Provider의 `ui.messages`를 통째로 대체.

### `getDefaultExtensions` (function export)

public export 유지. `extensions: { items, replace: true }` escape hatch에서 필요:

```tsx
import { getDefaultExtensions } from '@inkio/editor';

const myExtensions = getDefaultExtensions({ placeholder: '...' })
  .filter(ext => ext.name !== 'mention');

<Editor extensions={{ items: [...myExtensions, MyMention], replace: true }} />
```

### `useInkioEditor` hook

기존 signature 유지. `adapter` 옵션은 제거하고, flat options로 대체:

```ts
const editor = useInkioEditor({
  placeholder: '...',
  onImageUpload: uploadFn,
  extensions: [MyExtension],
});
```

### 기존 public exports

메뉴 컴포넌트(`BubbleMenu`, `FloatingMenu`, `Toolbar`, `TableMenu`), 액션 유틸(`defaultToolbarActions`, `getToolbarActionsFor`, `splitToolbarActionGroups`), 직렬화(`toPlainText`, `toSummary`, `getContentStats`), 마크다운(`@inkio/core/markdown`), 아이콘(`@inkio/core/icons`) 등은 모두 유지.

---

## 5. 내부 Extension 해결 흐름

### 해결 위치

Extension resolution은 **wrapper 패키지**(`@inkio/editor`, `@inkio/simple`)의 Editor 컴포넌트에서 수행. core의 Editor는 최종 `Extensions[]`만 받는다.

### 흐름

```
Wrapper Editor props 수신
  |
  v
flat props에서 extension config 구성:
  - onImageUpload → ImageBlock.configure({ onUpload })
  - hashtagItems → HashTag.configure({ items })
  - mentionItems → Mention.configure({ items })
  - comment → Comment.configure(comment)
  - etc.
  |
  v
getDefaultExtensions(config) → 기본 Extension[]
  |
  v
extensions prop 확인:
  ├── undefined          → 기본 그대로
  ├── Extension[]        → mergeExtensions(기본, user) [name 기반 dedup]
  └── { items, replace } → items만 사용
  |
  v
core Editor에 최종 Extensions[] 전달
```

### `onImageUpload` + `imageBlock` 병합 규칙

```ts
const resolvedImageBlockOptions = {
  ...imageBlock,                          // imageEditor, maxFileSize 등
  onUpload: onImageUpload ?? imageBlock?.onUpload,  // flat prop 우선
};
```

---

## 6. 영향받는 파일

### `@inkio/editor`
- `packages/editor/src/index.ts` - EditorProps/ViewerProps 재설계, Editor/Viewer 컴포넌트 변경
- `packages/editor/src/components/Editor.tsx` - (있다면) flat props → extension config 매핑 로직
- `packages/editor/src/components/Viewer.tsx` - ViewerProps 변경

### `@inkio/simple`
- `packages/simple/src/index.ts` - EditorProps/ViewerProps 재설계

### `@inkio/core`
- `packages/core/src/components/Editor.tsx` - `extensionRegistry`, `adapter`, `getDefaultExtensions` prop 제거. 최종 Extensions[]만 받도록 단순화
- `packages/core/src/components/Viewer.tsx` - 동일하게 단순화
- `packages/core/src/extensions/resolve-extensions.ts` - registry/adapter 분기 제거
- `packages/core/src/hooks/use-inkio-editor.ts` - adapter 옵션 제거
- `packages/core/src/index.ts` - `InkioExtensionRegistry`, `isInkioAdapter`, `InkioAdapter` export 제거

### `@inkio/advanced`
- `packages/advanced/src/get-default-extensions.ts` - adapter 의존성 제거, flat options 유지
- `packages/advanced/src/adapter.ts` - public export에서 제거

### `@inkio/essential`
- `packages/essential/src/get-default-extensions.ts` - 옵션 인터페이스 정리

### Examples
- `examples/basic-react/` - 새 API로 업데이트
- `examples/next-app-router/` - 새 API로 업데이트

### Docs
- `docs/content/getting-started.mdx` - 새 API 기준으로 업데이트
- `docs/content/components.mdx` - Props 문서 업데이트
