# Editor DX Simplification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the public API of `@inkio/simple` and `@inkio/editor` so a new developer can configure an editor in 5 minutes — flat props, additive extensions, no registry/adapter boilerplate.

**Architecture:** Wrapper packages (`@inkio/editor`, `@inkio/simple`) own the props-to-extensions mapping. Core's Editor/Viewer receive only a final `Extensions[]`. The `extensionRegistry`, `adapter` pattern, and `defaultExtensionsOptions` bag are removed from the public surface.

**Tech Stack:** React, TypeScript, Tiptap, Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-editor-dx-simplification-design.md`

---

## Chunk 1: Core Cleanup (remove registry, adapter, simplify resolution)

### Task 1: Remove `extensionRegistry` from core

**Files:**
- Delete: `packages/core/src/extensions/registry.ts`
- Modify: `packages/core/src/extensions/resolve-extensions.ts`
- Modify: `packages/core/src/components/Editor.tsx`
- Modify: `packages/core/src/components/Viewer.tsx`
- Modify: `packages/core/src/hooks/use-inkio-editor.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Remove `extensionRegistry` from `resolve-extensions.ts`**

Simplify `resolveInkioExtensions` to only handle explicit extensions or adapter+factory fallback. Remove registry branch.

```ts
// resolve-extensions.ts — new version
export interface ResolveInkioExtensionsOptions {
  extensions?: Extensions;
  adapter?: InkioAdapter;
  getDefaultExtensions?: DefaultExtensionsFactory;
  placeholder?: string;
}

export function resolveInkioExtensions(options: ResolveInkioExtensionsOptions): Extensions {
  const { extensions, adapter, getDefaultExtensions: factory, placeholder } = options;

  let resolved: Extensions;
  if (extensions && extensions.length > 0) {
    resolved = extensions;
  } else if (factory) {
    resolved = factory(adapter);
  } else {
    resolved = getExtensions({ placeholder });
  }

  return resolved;
}
```

- [ ] **Step 2: Remove `extensionRegistry` prop from core `EditorProps`**

In `packages/core/src/components/Editor.tsx`, remove `extensionRegistry` from the `EditorProps` type and destructuring.

- [ ] **Step 3: Remove `extensionRegistry` prop from core `ViewerProps`**

In `packages/core/src/components/Viewer.tsx`, same removal.

- [ ] **Step 4: Remove `extensionRegistry` from `useInkioEditor`**

In `packages/core/src/hooks/use-inkio-editor.ts`, remove from `UseInkioEditorOptions` and the `resolveInkioExtensions` call.

- [ ] **Step 5: Remove registry exports from `packages/core/src/index.ts`**

Remove: `createInkioExtensionRegistry`, `InkioExtensionRegistry` (type), `InkioExtensionCategory` (type).

- [ ] **Step 6: Delete `packages/core/src/extensions/registry.ts`**

- [ ] **Step 7: Run typecheck and tests**

```bash
pnpm --filter @inkio/core typecheck && pnpm --filter @inkio/core test
```

- [ ] **Step 8: Commit**

```bash
git add -A packages/core/
git commit -m "refactor(core): remove extensionRegistry from public API"
```

---

### Task 2: Remove `adapter` pattern from core public surface

**Files:**
- Modify: `packages/core/src/components/Editor.tsx` — remove `adapter`, `getDefaultExtensions` props
- Modify: `packages/core/src/components/Viewer.tsx` — same
- Modify: `packages/core/src/hooks/use-inkio-editor.ts` — remove adapter from options
- Modify: `packages/core/src/extensions/resolve-extensions.ts` — simplify to extensions-only
- Modify: `packages/core/src/context/InkioProvider.tsx` — remove `adapter`, `getDefaultExtensions`
- Modify: `packages/core/src/index.ts` — remove `isInkioAdapter`, `InkioAdapter` exports

> **Note:** `adapter.ts` 파일 자체는 삭제하지 않음. 내부 코드에서 아직 타입으로 참조될 수 있으므로 export만 제거.

- [ ] **Step 1: Simplify `resolve-extensions.ts` to extensions-only**

```ts
export function resolveInkioExtensions(
  extensions: Extensions | undefined,
  placeholder?: string,
): Extensions {
  if (extensions && extensions.length > 0) {
    return extensions;
  }
  return getExtensions({ placeholder });
}
```

- [ ] **Step 2: Remove `adapter`, `getDefaultExtensions` from core `EditorProps`**

Keep: `extensions`, `placeholder`, `editable`, content props, UI props, menu props, locale/messages/icons.
Remove: `adapter`, `getDefaultExtensions`, `extensionRegistry` (already done in Task 1).

- [ ] **Step 3: Update core Editor component to use simplified resolution**

```ts
const resolvedExtensions = resolveInkioExtensions(extensions, placeholder);
```

- [ ] **Step 4: Same changes for core `ViewerProps` and Viewer component**

- [ ] **Step 5: Remove `adapter` from `useInkioEditor` options**

Update `UseInkioEditorOptions` — remove `adapter`, `getDefaultExtensions`, `extensionRegistry`. The hook receives a final `extensions` array.

- [ ] **Step 6: Simplify `InkioProvider`**

New `InkioProviderProps`:
```ts
interface InkioProviderProps {
  children: React.ReactNode;
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}
```

Remove `adapter`, `getDefaultExtensions` from context. Keep locale/messages/icons for shared i18n.

- [ ] **Step 7: Remove adapter exports from `packages/core/src/index.ts`**

Remove: `isInkioAdapter`, `InkioAdapter` type export.

- [ ] **Step 8: Run typecheck and tests, fix any breakage**

```bash
pnpm --filter @inkio/core typecheck && pnpm --filter @inkio/core test
```

- [ ] **Step 9: Commit**

```bash
git add -A packages/core/
git commit -m "refactor(core): remove adapter pattern from public API"
```

---

## Chunk 2: Comment Extension Naming Cleanup

### Task 3: Rename comment interfaces and callbacks

**Files:**
- Modify: `packages/advanced/src/comment/Comment.ts` — rename CommentOptions fields
- Modify: `packages/advanced/src/comment/components/CommentComposer.tsx` — update callback references
- Modify: `packages/advanced/src/comment/components/CommentThreadPopover.tsx` — update callback references
- Modify: `packages/advanced/src/comment/components/CommentPanel.tsx` — update types
- Modify: `packages/advanced/src/comment/comment-composer-plugin.tsx` — update references
- Modify: `packages/advanced/src/comment/comment-thread-popover-plugin.tsx` — update references
- Modify: `packages/advanced/src/comment/index.ts` — update exports
- Modify: `packages/advanced/src/get-default-extensions.ts` — update comment config mapping
- Modify: `packages/advanced/src/index.ts` — update exports

- [ ] **Step 1: Define new `CommentConfig` and `CommentData` types**

In `Comment.ts`, add the new public-facing types alongside existing ones:

```ts
// New public-facing config (used by Editor props)
export interface CommentConfig {
  onSubmit?: (commentId: string, text: string, selection: string) => void;
  onReply?: (commentId: string, text: string) => void;
  onResolve?: (commentId: string) => void;
  onUnresolve?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  getComments?: (commentId: string) => CommentData | null;
  generateId?: () => string;
}

// Rename CommentThreadData → CommentData
export interface CommentData {
  // ... same fields as current CommentThreadData
}
```

- [ ] **Step 2: Add `toCommentOptions` mapper function**

Maps new `CommentConfig` to internal `CommentOptions`:

```ts
export function toCommentOptions(config: CommentConfig): Partial<CommentOptions> {
  return {
    onCommentSubmit: config.onSubmit,
    onCommentReply: config.onReply,
    onCommentResolve: config.onResolve,
    onCommentUnresolve: config.onUnresolve,
    onCommentDelete: config.onDelete,
    getThread: config.getComments,
    generateId: config.generateId,
  };
}
```

> **Note:** 내부적으로는 기존 `CommentOptions` 필드명을 유지하여 변경 범위를 최소화. 공개 API만 `CommentConfig`를 사용.

- [ ] **Step 3: Export new types from advanced package**

In `packages/advanced/src/comment/index.ts` and `packages/advanced/src/index.ts`, add exports for `CommentConfig`, `CommentData`, `toCommentOptions`.

- [ ] **Step 4: Update `get-default-extensions.ts` to accept `CommentConfig`**

Change the `comment` field in `DefaultExtensionsOptions` from `CommentOptions` to `CommentConfig`:

```ts
comment?: false | CommentConfig;
```

And map it internally:
```ts
if (comment) {
  extensions.push(Comment.configure({ ...toCommentOptions(comment) }));
}
```

- [ ] **Step 5: Run typecheck and tests**

```bash
pnpm --filter @inkio/advanced typecheck && pnpm --filter @inkio/advanced test
```

- [ ] **Step 6: Commit**

```bash
git add -A packages/advanced/
git commit -m "refactor(advanced): introduce CommentConfig with simplified naming"
```

---

## Chunk 3: `@inkio/editor` Props Redesign

### Task 4: Implement new `EditorProps` for `@inkio/editor`

**Files:**
- Modify: `packages/editor/src/components/Editor.tsx` — new props interface + mapping logic
- Create: `packages/editor/src/types.ts` — shared types (`ExtensionsInput`, `EditorUiOptions`)
- Create: `packages/editor/src/utils/build-extensions.ts` — flat props → extensions mapper
- Create: `packages/editor/src/utils/merge-extensions.ts` — additive extension merge with dedup
- Test: `packages/editor/src/__tests__/merge-extensions.test.ts`
- Test: `packages/editor/src/__tests__/build-extensions.test.ts`

- [ ] **Step 1: Write test for `mergeExtensions`**

```ts
// packages/editor/src/__tests__/merge-extensions.test.ts
import { describe, it, expect } from 'vitest';
import { mergeExtensions } from '../utils/merge-extensions';

describe('mergeExtensions', () => {
  it('appends user extensions to defaults', () => {
    const defaults = [{ name: 'bold' }, { name: 'italic' }] as any[];
    const user = [{ name: 'custom' }] as any[];
    const result = mergeExtensions(defaults, user);
    expect(result.map(e => e.name)).toEqual(['bold', 'italic', 'custom']);
  });

  it('replaces default extension when user extension has same name', () => {
    const defaults = [{ name: 'mention', options: { a: 1 } }] as any[];
    const user = [{ name: 'mention', options: { b: 2 } }] as any[];
    const result = mergeExtensions(defaults, user);
    expect(result).toHaveLength(1);
    expect(result[0].options).toEqual({ b: 2 });
  });

  it('returns defaults when user array is empty', () => {
    const defaults = [{ name: 'bold' }] as any[];
    const result = mergeExtensions(defaults, []);
    expect(result).toEqual(defaults);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @inkio/editor test -- --run merge-extensions
```

- [ ] **Step 3: Implement `mergeExtensions`**

```ts
// packages/editor/src/utils/merge-extensions.ts
import type { Extensions } from '@tiptap/core';

export function mergeExtensions(defaults: Extensions, userExtensions: Extensions): Extensions {
  if (userExtensions.length === 0) return defaults;
  const userNames = new Set(userExtensions.map(ext => ext.name));
  const filtered = defaults.filter(ext => !userNames.has(ext.name));
  return [...filtered, ...userExtensions];
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Create shared types**

```ts
// packages/editor/src/types.ts
import type { Extensions } from '@tiptap/core';

export type ExtensionsInput =
  | Extensions
  | { items: Extensions; replace?: boolean };
```

- [ ] **Step 6: Write test for `buildExtensions`**

```ts
// packages/editor/src/__tests__/build-extensions.test.ts
import { describe, it, expect } from 'vitest';
import { resolveExtensionsInput } from '../utils/build-extensions';

describe('resolveExtensionsInput', () => {
  it('returns defaults when no input', () => {
    const defaults = [{ name: 'bold' }] as any[];
    expect(resolveExtensionsInput(undefined, defaults)).toEqual(defaults);
  });

  it('merges array input additively', () => {
    const defaults = [{ name: 'bold' }] as any[];
    const input = [{ name: 'custom' }] as any[];
    const result = resolveExtensionsInput(input, defaults);
    expect(result.map(e => e.name)).toEqual(['bold', 'custom']);
  });

  it('replaces when object with replace: true', () => {
    const defaults = [{ name: 'bold' }] as any[];
    const input = { items: [{ name: 'custom' }] as any[], replace: true };
    const result = resolveExtensionsInput(input, defaults);
    expect(result.map(e => e.name)).toEqual(['custom']);
  });
});
```

- [ ] **Step 7: Implement `resolveExtensionsInput`**

```ts
// packages/editor/src/utils/build-extensions.ts
import type { Extensions } from '@tiptap/core';
import type { ExtensionsInput } from '../types';
import { mergeExtensions } from './merge-extensions';

export function resolveExtensionsInput(
  input: ExtensionsInput | undefined,
  defaults: Extensions,
): Extensions {
  if (!input) return defaults;

  if (Array.isArray(input)) {
    return mergeExtensions(defaults, input);
  }

  if (input.replace) {
    return input.items;
  }

  return mergeExtensions(defaults, input.items);
}
```

- [ ] **Step 8: Run tests to verify**

```bash
pnpm --filter @inkio/editor test
```

- [ ] **Step 9: Implement new `EditorProps` and Editor component**

Rewrite `packages/editor/src/components/Editor.tsx`:

- New `EditorProps` interface with flat props, `ui` object, feature callbacks, feature toggles
- Internal mapping: flat props → `DefaultExtensionsOptions` → `getDefaultExtensions()` → final extensions
- `resolveExtensionsInput()` for user extensions
- Pass resolved extensions + UI props to core Editor

Key mapping logic:
```ts
function buildDefaultExtensionsOptions(props: EditorProps): DefaultExtensionsOptions {
  return {
    placeholder: props.placeholder,
    tabBehavior: props.tabBehavior,
    imageBlock: {
      ...props.imageBlock,
      onUpload: props.onImageUpload ?? props.imageBlock?.onUpload,
    },
    hashtagItems: props.hashtagItems,
    mentionItems: props.mentionItems,
    slashCommands: props.slashCommands,
    transformSlashCommands: props.transformSlashCommands,
    onWikiLinkClick: props.onWikiLinkClick,
    onError: props.onError,
    comment: props.comment === false ? false : props.comment,
    bookmark: props.bookmark === false ? false : !!props.bookmark,
    onResolveBookmark: typeof props.bookmark === 'object' ? props.bookmark.onResolveBookmark : undefined,
    blockHandle: props.blockHandle,
    wikiLink: props.wikiLink,
    table: props.table,
    callout: props.callout,
    toggleList: props.toggleList,
    locale: props.locale,
    messages: props.ui?.messages,
    icons: props.ui?.icons,
  };
}
```

- [ ] **Step 10: Run typecheck and tests**

```bash
pnpm --filter @inkio/editor typecheck && pnpm --filter @inkio/editor test
```

- [ ] **Step 11: Commit**

```bash
git add -A packages/editor/
git commit -m "feat(editor): redesign EditorProps with flat props and additive extensions"
```

---

### Task 5: Implement new `ViewerProps` for `@inkio/editor`

**Files:**
- Modify: `packages/editor/src/components/Viewer.tsx` — new ViewerProps + toc grouping + comment support

- [ ] **Step 1: Rewrite Viewer with new props**

New `ViewerProps`:
- `content` (required, no `initialContent`)
- `locale`, `ui` (className, style, bordered, messages, icons)
- `toc?: boolean | { position?, onHeadingsReady? }`
- `comment?: { getComments, onReply?, onResolve? }`
- `extensions?: ExtensionsInput`

Map `toc` to core's `tableOfContents` + `onHeadingsReady`.
Map `comment` to Comment extension config (read-only mode).

- [ ] **Step 2: Run typecheck and tests**

```bash
pnpm --filter @inkio/editor typecheck && pnpm --filter @inkio/editor test
```

- [ ] **Step 3: Commit**

```bash
git add -A packages/editor/
git commit -m "feat(editor): redesign ViewerProps with toc grouping and comment support"
```

---

### Task 6: Update `@inkio/editor` exports

**Files:**
- Modify: `packages/editor/src/index.ts` — update exports, remove adapter/registry re-exports

- [ ] **Step 1: Update index.ts**

- Export new `EditorProps`, `ViewerProps`, `ExtensionsInput`, `CommentConfig`, `CommentData` types
- Remove: `isInkioAdapter`, `DefaultExtensionsOptions` (replaced by flat props)
- Keep: `getDefaultExtensions`, all menu components, serialization, markdown, icons

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @inkio/editor typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A packages/editor/
git commit -m "refactor(editor): update package exports for new API"
```

---

## Chunk 4: `@inkio/simple` Props Redesign

### Task 7: Implement new `EditorProps` for `@inkio/simple`

**Files:**
- Modify: `packages/simple/src/components/Editor.tsx` — new props, same pattern as editor
- Modify: `packages/simple/src/components/Viewer.tsx` — new ViewerProps
- Modify: `packages/simple/src/index.ts` — update exports
- Reuse: `packages/editor/src/utils/merge-extensions.ts` (or extract to shared location)

> **Note:** `@inkio/simple`은 core extensions만 사용. advanced 기능(mention, hashtag, comment 등) 없음. `mergeExtensions`와 `resolveExtensionsInput`은 `@inkio/editor`에서 가져오거나, 작은 유틸이므로 복사해도 무방.

- [ ] **Step 1: Implement simple Editor with flat props**

Props: `placeholder`, `locale`, `tabBehavior`, `editable`, `onImageUpload`, `onError`, `ui`, `extensions`

Mapping: flat props → `CoreExtensionOptions` → `getExtensions()` → `resolveExtensionsInput()`

- [ ] **Step 2: Implement simple Viewer with new ViewerProps**

Props: `content`, `locale`, `ui`, `toc`, `extensions`

- [ ] **Step 3: Update exports**

Remove: `DefaultExtensionsOptions`, adapter re-exports
Add: `ExtensionsInput` type

- [ ] **Step 4: Run typecheck and tests**

```bash
pnpm --filter @inkio/simple typecheck && pnpm --filter @inkio/simple test
```

- [ ] **Step 5: Commit**

```bash
git add -A packages/simple/
git commit -m "feat(simple): redesign props with flat API and additive extensions"
```

---

## Chunk 5: Examples, Docs, Integration Tests

### Task 8: Update example apps

**Files:**
- Modify: `examples/basic-react/src/App.tsx` — use new `@inkio/simple` API
- Modify: `examples/next-app-router/components/editor-demo.tsx` — use new `@inkio/editor` API
- Modify: `examples/next-app-router/app/globals.css` — if needed

- [ ] **Step 1: Update basic-react example**

```tsx
// Before
const extensions = useMemo(() => getDefaultExtensions({ placeholder: '...' }), []);
<Editor extensions={extensions} />

// After
<Editor placeholder="Write something..." onUpdate={handleUpdate} />
```

- [ ] **Step 2: Update next-app-router example**

```tsx
// Before
<Editor defaultExtensionsOptions={options} showToolbar showBubbleMenu />

// After
<Editor
  placeholder="Write..."
  locale={locale}
  ui={{ showToolbar: true, showBubbleMenu: true, messages, icons }}
  hashtagItems={getHashtags}
  onImageUpload={uploadImage}
  imageBlock={{ imageEditor: LazyImageEditorModal }}
  comment={{ onSubmit: handleSubmit, getComments: fetchComments }}
/>
```

- [ ] **Step 3: Build examples**

```bash
pnpm examples:build
```

- [ ] **Step 4: Commit**

```bash
git add -A examples/
git commit -m "docs(examples): update to new simplified Editor API"
```

---

### Task 9: Update docs

**Files:**
- Modify: `docs/content/getting-started.mdx`
- Modify: `docs/content/components.mdx`

- [ ] **Step 1: Update getting-started with simplest usage**

```tsx
import { Editor } from '@inkio/simple';

<Editor placeholder="Start writing..." onUpdate={(json) => console.log(json)} />
```

- [ ] **Step 2: Update components page with full props reference**

Document `EditorProps`, `ViewerProps`, `ExtensionsInput` for both packages.

- [ ] **Step 3: Build docs**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add -A docs/
git commit -m "docs: update API documentation for simplified props"
```

---

### Task 10: Full integration verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

- [ ] **Step 3: Run e2e tests**

```bash
pnpm e2e
```

- [ ] **Step 4: Run build**

```bash
pnpm build
```

- [ ] **Step 5: Fix any remaining issues**

- [ ] **Step 6: Final commit if needed**

```bash
git commit -m "chore: fix integration issues from DX simplification"
```
