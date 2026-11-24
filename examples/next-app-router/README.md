# Next App Router Example

Next.js App Router에서 `@inkio/editor`를 붙이는 기준 예제입니다.
notion-like preset, comments, image editor integration을 함께 보여줍니다.

실행:

```bash
pnpm install
pnpm --filter example-next-app-router dev
```

핵심 파일:

- `components/editor-demo.tsx`: 클라이언트에서 `comment`, `mentionItems`, `hashtagItems`, `wikiLinkItems`, `onImageUpload`, `imageBlock.imageEditor`를 연결합니다. 댓글과 이미지 URL은 새로고침 후 보존되지 않습니다.
- `components/viewer-e2e-harness.tsx`: 편집 결과를 프리셋 `Viewer`와 `@inkio/core/static`의 `StaticViewer`에 전달합니다. 정적 뷰어에는 고급 문서 노드를 위한 확장을 별도로 추가합니다.
- `app/layout.tsx`: 프리셋과 이미지 에디터의 CSS를 앱 스타일보다 먼저 불러옵니다.
- `next.config.mjs`: 워크스페이스 소스를 사용하는 `dev`/`build:smoke` 전용 alias를 설정합니다.
