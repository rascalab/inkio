# @inkio/server

Inkio 서버사이드 유틸리티 패키지.

> 이 패키지는 현재 개발 초기 단계입니다.
> Markdown import/export의 source of truth는 `@inkio/core/markdown`입니다.

문서: https://rascalab.github.io/inkio/

## Install

```bash
npm install @inkio/server
# or
pnpm add @inkio/server
```

Peer dependencies: `@inkio/core` 또는 상위 진입점 패키지(`@inkio/simple`, `@inkio/editor`)

## Packages

| Package | Description |
|---|---|
| [`@inkio/core`](https://www.npmjs.com/package/@inkio/core) | 저수준 foundation |
| [`@inkio/simple`](https://www.npmjs.com/package/@inkio/simple) | classic WYSIWYG 진입점 |
| [`@inkio/editor`](https://www.npmjs.com/package/@inkio/editor) | notion-like 진입점 |
| [`@inkio/essential`](https://www.npmjs.com/package/@inkio/essential) | markdown-friendly 확장 묶음 |
| [`@inkio/advanced`](https://www.npmjs.com/package/@inkio/advanced) | notion-like / integration-heavy 확장 묶음 |
| [`@inkio/server`](https://www.npmjs.com/package/@inkio/server) | 서버사이드 유틸리티 |

## License

MIT
