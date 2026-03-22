# Image Editor Bug Fixes & Visual Overhaul — Design Spec

## Goal

Fix 5 bugs in `@inkio/image-editor` + visual overhaul to transform the editor from an opaque fullscreen modal into a lightweight, translucent overlay editor (iOS Photos / Figma style).

---

## Visual Overhaul: Translucent Overlay Editor

### Current → Target

| Element | Current | Target |
|---------|---------|--------|
| Modal backdrop | Opaque blurred `color-mix(var(--inkio-bg) 56%, ...)` | Semi-transparent `rgba(0,0,0,0.5)`, reduced blur |
| Image area | Checkerboard + stage-frame with border/shadow | Clean, no extra chrome. Image floats in center |
| Left toolbar | Glass morphism (partially) | Consistent glass: `backdrop-filter: blur()` + semi-transparent bg |
| Bottom dock | Glass morphism (partially) | Same consistent glass treatment |
| Top zoom controls | Glass morphism (partially) | Same consistent glass treatment |
| Checkerboard div | Exists in EditorCanvas.tsx | Remove entirely |

### Files
- `packages/image-editor/src/style.css` — modal-content bg opacity, remove `.inkio-ie-stage-checkerboard`, verify glass consistency
- `packages/image-editor/src/canvas/EditorCanvas.tsx` — remove checkerboard div (line ~771)

---

## Bug Fixes

### Bug 1: 90° 회전 시 이미지 찌그러짐

**Root cause**: `getTransformedDimensions()` returns swapped width/height for 90°/270°. `ImageNode` uses swapped values as width/height, distorting the image.

**Fix**: Add `getBaseDisplayDimensions(displayWidth: number, displayHeight: number, rotation: number) → { width, height }` — un-swaps dimensions for quarter turns. `ImageNode` renders with base dimensions + Konva `rotation` prop. `DesignLayer` annotation group uses base dimensions for rotation pivot (`offsetX/offsetY`).

**Note**: 3 tests already written for this fix are currently RED (expect `getBaseDisplayDimensions` which doesn't exist yet). After this fix, they should go GREEN.

**Impact**: `cropSessionBounds` at `EditorCanvas.tsx:101-110` falls back to `workingDimensions` (swapped). This is correct — crop session operates in post-transform space. No change needed there.

**Files**:
- `packages/image-editor/src/utils/geometry.ts` — add `getBaseDisplayDimensions()`, add `isQuarterTurn()` helper
- `packages/image-editor/src/canvas/ImageNode.tsx` — use base dimensions for width/height/offset, keep `rotation` prop
- `packages/image-editor/src/canvas/DesignLayer.tsx` — use base dimensions for annotation group offsetX/offsetY
- `packages/image-editor/src/utils/export-canvas.ts` — same base dimensions logic for export rendering

### Bug 2: 회전 후 shape 위치 오프셋

**Root cause**: `toAnnotationPoint()` at `EditorCanvas.tsx:338-343` applies only `pos / scaleToFit + cropOffset`, ignoring rotation/flip.

**Fix**: Update `canvasSpaceToImageSpace()` signature to accept full `Transform` (which includes `crop`, `rotation`, `flipX`, `flipY`). Transform chain: canvas point → center-relative → inverse rotation → inverse flip → un-center (using base display dimensions) → scale to crop space → add crop offset.

Replace `toAnnotationPoint()` body with:
```ts
canvasSpaceToImageSpace(
  pos.x, pos.y,
  displayWidth, displayHeight,
  state.originalWidth, state.originalHeight,
  state.transform,
)
```

**Files**:
- `packages/image-editor/src/utils/geometry.ts` — update `canvasSpaceToImageSpace(cx, cy, displayWidth, displayHeight, originalWidth, originalHeight, transform: Transform)` to handle crop from `transform.crop`
- `packages/image-editor/src/canvas/EditorCanvas.tsx` — `toAnnotationPoint()` calls updated `canvasSpaceToImageSpace`

### Bug 3: Crop area가 이미지 영역 밖으로 확장

**Root cause**: `getCropFrameRect(stageWidth, stageHeight, ...)` uses viewport size, not image display bounds.

**Fix**: Calculate `cropFitBounds` — the actual fitted image rect within the viewport. Pass to `getCropFrameRect(imageBounds, aspectRatio)`. For rotated crops, `cropSessionBounds` uses `transformRect()` to project crop into working space.

Add `transformRect(rect, origW, origH, rotation, flipX, flipY, inverse?)` to geometry.ts — transforms a rect through rotation/flip using corner projection.

When dispatching `SET_PENDING_CROP`, inverse-transform the crop rect back to original image space using `transformRect(..., inverse=true)`.

**Files**:
- `packages/image-editor/src/utils/geometry.ts` — add `transformRect()`, add `transformPoint()` helper
- `packages/image-editor/src/canvas/EditorCanvas.tsx` — `cropFitBounds` calculation, `getCropFrameRect(imageBounds, ...)` signature, `cropSessionBounds` with `transformRect`, `SET_PENDING_CROP` inverse transform

### Bug 4: 옵션바 항상 표시 + 기본 crop 활성화

**Root cause**: Tool toggles off when clicked again — `use-image-editor-session.ts:133-151` calls `closeChrome()` when `currentTool === nextTool`, setting tool to `null`. Escape key in `use-keyboard-shortcuts.ts:33-36` dispatches `SET_TOOL, tool: null`.

**Fix**:
- Default `activeTool` to `'resize'` — set via existing `defaultTool` prop mechanism in `ImageEditor.tsx` (not `initialState` in reducer, to avoid issues with zero-dimension images before image load)
- `use-image-editor-session.ts`: when `currentTool === nextTool`, no-op instead of `closeChrome()`
- `use-keyboard-shortcuts.ts`: Escape sets tool to `'resize'` (default) instead of `null`

**Files**:
- `packages/image-editor/src/hooks/use-image-editor-session.ts` — prevent toggle-off (no-op when same tool)
- `packages/image-editor/src/hooks/use-keyboard-shortcuts.ts` — Escape → default tool instead of null
- `packages/image-editor/src/ImageEditor.tsx` — default tool to `'resize'` via `defaultTool` prop

### Bug 5: annotation-bounds.ts projectPoint flip/rotation 순서 불일치

**Root cause**: `projectPoint` at `annotation-bounds.ts:49-65` applies flip → rotation. `DesignLayer` applies rotation → flip. Selection overlay drifts.

**Fix**: Remove `projectPoint`. Use `imageSpaceToCanvasSpace()` from geometry.ts. This requires:
1. Add `originalHeight` to `DisplayProjectionOptions` interface
2. `SelectionActionsOverlay` must receive and pass `originalHeight`
3. `EditorCanvas` must pass `originalHeight` to `SelectionActionsOverlay`
4. Construct a `Transform` from the projection options to pass to `imageSpaceToCanvasSpace()`

**Files**:
- `packages/image-editor/src/utils/annotation-bounds.ts` — replace `projectPoint` with `imageSpaceToCanvasSpace()`, add `originalHeight` to interface
- `packages/image-editor/src/canvas/SelectionActionsOverlay.tsx` — add `originalHeight` prop
- `packages/image-editor/src/canvas/EditorCanvas.tsx` — pass `originalHeight` to `SelectionActionsOverlay`

---

## Implementation Order

1. **Visual overhaul** (CSS/JSX) — independent, easy verify
2. **Bug 4** (toolbar always-on) — UX, independent
3. **Bug 1** (rotation distortion) — foundational geometry. 3 RED tests go GREEN
4. **Bug 2** (shape offset) — uses Bug 1's base dimensions + updated canvasSpaceToImageSpace
5. **Bug 3** (crop bounds) — uses transformRect for rotation-aware crop
6. **Bug 5** (annotation-bounds) — reuses geometry functions, adds originalHeight plumbing

Each step: fix → typecheck → test → browser verify → commit.

## Testing Strategy

- **Before Bug 1**: 69/72 tests pass (3 RED expected — tests for Bug 1 written ahead of implementation)
- **After Bug 1**: all 72 tests pass
- **After each subsequent step**: all tests pass
- New unit tests for `transformRect`, `transformPoint`, updated `canvasSpaceToImageSpace`
- Manual browser verification after each step:
  - Rotate 90° → image not distorted
  - Create shapes after rotation → correct position
  - Crop → constrained to image bounds
  - Switch tools → options bar never disappears
  - Escape → goes to resize tool, not empty
  - Modal shows page behind with transparency
  - Glass morphism on toolbar/dock/zoom
