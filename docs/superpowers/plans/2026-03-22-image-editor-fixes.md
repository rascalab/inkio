# Image Editor Fixes & Visual Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs (rotation distortion, shape offset, crop bounds, toolbar UX, annotation-bounds) and transform the image editor modal into a translucent overlay with glass morphism.

**Architecture:** Each bug fix targets specific geometry/coordinate transform functions in `geometry.ts` and their consumers (`ImageNode`, `DesignLayer`, `EditorCanvas`, `annotation-bounds`). Visual overhaul is CSS-only plus one JSX deletion. Fixes are ordered by dependency chain: geometry foundation → consumers → CSS/UX.

**Tech Stack:** React, Konva (react-konva), TypeScript, Vitest, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-22-image-editor-fixes-design.md`

---

## File Map

| File | Responsibility | Tasks |
|------|---------------|-------|
| `packages/image-editor/src/utils/geometry.ts` | Coordinate transforms, dimension helpers | 1, 2, 3 |
| `packages/image-editor/src/canvas/ImageNode.tsx` | Konva image rendering with rotation | 1 |
| `packages/image-editor/src/canvas/DesignLayer.tsx` | Annotation layer with rotation pivot | 1 |
| `packages/image-editor/src/utils/export-canvas.ts` | Canvas export with rotation | 1 |
| `packages/image-editor/src/canvas/EditorCanvas.tsx` | Main canvas: toAnnotationPoint, crop frame, checkerboard | 2, 3, 5 |
| `packages/image-editor/src/utils/annotation-bounds.ts` | Selection overlay positioning | 4 |
| `packages/image-editor/src/canvas/SelectionActionsOverlay.tsx` | Selection actions pill | 4 |
| `packages/image-editor/src/hooks/use-image-editor-session.ts` | Tool change logic, toggle behavior | 6 |
| `packages/image-editor/src/hooks/use-keyboard-shortcuts.ts` | Escape key handler | 6 |
| `packages/image-editor/src/ImageEditor.tsx` | Default tool prop | 6 |
| `packages/image-editor/src/style.css` | Modal bg, checkerboard, glass, dock | 5 |

---

### Task 1: Rotation distortion fix — `getBaseDisplayDimensions`

**Files:**
- Modify: `packages/image-editor/src/utils/geometry.ts`
- Modify: `packages/image-editor/src/canvas/ImageNode.tsx`
- Modify: `packages/image-editor/src/canvas/DesignLayer.tsx`
- Modify: `packages/image-editor/src/utils/export-canvas.ts`
- Test: `packages/image-editor/src/__tests__/geometry.test.ts` (3 RED tests already exist)

- [ ] **Step 1: Read existing geometry.ts and understand current `getTransformedDimensions`**

Read `packages/image-editor/src/utils/geometry.ts`. Note that `getTransformedDimensions` swaps width/height for 90°/270° rotation. The 3 failing tests in `geometry.test.ts` expect `getBaseDisplayDimensions` and `isQuarterTurn` to exist.

- [ ] **Step 2: Add `isQuarterTurn` and `getBaseDisplayDimensions` to geometry.ts**

```typescript
export function isQuarterTurn(rotation: number): boolean {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 270;
}

export function getBaseDisplayDimensions(
  displayWidth: number,
  displayHeight: number,
  rotation: number,
): { width: number; height: number } {
  return isQuarterTurn(rotation)
    ? { width: displayHeight, height: displayWidth }
    : { width: displayWidth, height: displayHeight };
}
```

- [ ] **Step 3: Run tests to verify the 3 RED tests go GREEN**

Run: `pnpm --filter @inkio/image-editor test`
Expected: All 72 tests pass (including the 3 previously failing geometry/ImageNode tests)

- [ ] **Step 4: Update ImageNode.tsx to use `getBaseDisplayDimensions`**

Read `ImageNode.tsx`. Import `getBaseDisplayDimensions`. Calculate `baseDisplayWidth`/`baseDisplayHeight` from `getBaseDisplayDimensions(displayWidth, displayHeight, transform.rotation)`. Use base dimensions for:
- `width`/`height` of KonvaImage
- `offsetX`/`offsetY` (center pivot)
- Non-crop branch: `scaleX`/`scaleY` calculation uses `baseDisplayWidth/originalWidth`

Keep `x={displayWidth/2}`, `y={displayHeight/2}` (center position in stage).

- [ ] **Step 5: Update DesignLayer.tsx annotation group to use base dimensions**

Read `DesignLayer.tsx`. Import `getBaseDisplayDimensions`. The annotation `<Group>` at lines 55-62 should use base dimensions for `offsetX`/`offsetY`:
```tsx
const { width: baseDisplayWidth, height: baseDisplayHeight } = getBaseDisplayDimensions(
  displayWidth, displayHeight, rotation,
);
// Group props:
// offsetX={baseDisplayWidth / 2}
// offsetY={baseDisplayHeight / 2}
```

Also update `annScale` calculation to use `baseDisplayWidth`/`baseDisplayHeight`.

- [ ] **Step 6: Update export-canvas.ts to use same base dimensions logic**

Read `packages/image-editor/src/utils/export-canvas.ts`. Find where it renders the image for export. Apply the same `getBaseDisplayDimensions` logic so exported images match the preview.

- [ ] **Step 7: Run all tests + typecheck**

Run: `pnpm typecheck && pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 8: Browser verify — rotate 90°, check image is not distorted**

Open playground → image editor → rotate 90° → image should maintain correct aspect ratio.

- [ ] **Step 9: Commit**

```bash
git add packages/image-editor/src/utils/geometry.ts packages/image-editor/src/canvas/ImageNode.tsx packages/image-editor/src/canvas/DesignLayer.tsx packages/image-editor/src/utils/export-canvas.ts
git commit -m "fix(image-editor): rotation distortion — use base display dimensions"
```

---

### Task 2: Shape offset after rotation — update `canvasSpaceToImageSpace`

**Files:**
- Modify: `packages/image-editor/src/utils/geometry.ts`
- Modify: `packages/image-editor/src/canvas/EditorCanvas.tsx`
- Test: `packages/image-editor/src/__tests__/geometry.test.ts`

- [ ] **Step 1: Write test for updated `canvasSpaceToImageSpace` with rotation + crop**

Add to `geometry.test.ts`:
```typescript
describe('canvasSpaceToImageSpace', () => {
  it('maps center of display to center of crop region', () => {
    const transform = { rotation: 0, flipX: false, flipY: false, crop: { x: 100, y: 50, width: 400, height: 300 } };
    const result = canvasSpaceToImageSpace(50, 50, 100, 100, 800, 600, transform);
    expect(result.x).toBeCloseTo(300); // center of crop
    expect(result.y).toBeCloseTo(200);
  });

  it('accounts for 90° rotation', () => {
    const transform = { rotation: 90, flipX: false, flipY: false, crop: null };
    // After 90° rotation, displayWidth=600 displayHeight=800 (swapped)
    const result = canvasSpaceToImageSpace(300, 400, 600, 800, 800, 600, transform);
    expect(result.x).toBeCloseTo(400); // center of original
    expect(result.y).toBeCloseTo(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @inkio/image-editor test`
Expected: New tests FAIL

- [ ] **Step 3: Update `canvasSpaceToImageSpace` in geometry.ts**

Update signature to accept `Transform` object. Implementation:
```typescript
export function canvasSpaceToImageSpace(
  cx: number, cy: number,
  displayWidth: number, displayHeight: number,
  originalWidth: number, originalHeight: number,
  transform: Transform,
): { x: number; y: number } {
  const { width: baseW, height: baseH } = getBaseDisplayDimensions(displayWidth, displayHeight, transform.rotation);

  // 1. Center-relative in stage space
  let lx = cx - displayWidth / 2;
  let ly = cy - displayHeight / 2;

  // 2. Inverse rotation
  const rad = (-transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = lx * cos - ly * sin;
  const ry = lx * sin + ly * cos;

  // 3. Inverse flip
  lx = rx * (transform.flipX ? -1 : 1);
  ly = ry * (transform.flipY ? -1 : 1);

  // 4. Un-center (base display space)
  lx += baseW / 2;
  ly += baseH / 2;

  // 5. Scale to image/crop space + crop offset
  const crop = transform.crop ?? { x: 0, y: 0, width: originalWidth, height: originalHeight };
  return {
    x: (lx / baseW) * crop.width + crop.x,
    y: (ly / baseH) * crop.height + crop.y,
  };
}
```

Also update `imageSpaceToCanvasSpace` symmetrically.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 5: Update `toAnnotationPoint` in EditorCanvas.tsx**

Read `EditorCanvas.tsx` lines 338-343. Replace:
```typescript
const toAnnotationPoint = useCallback(
  (pos: { x: number; y: number }) => {
    return canvasSpaceToImageSpace(
      pos.x, pos.y,
      displayWidth, displayHeight,
      state.originalWidth, state.originalHeight,
      state.transform,
    );
  },
  [displayWidth, displayHeight, state.originalWidth, state.originalHeight, state.transform],
);
```

Add import for `canvasSpaceToImageSpace` from `../utils/geometry`.

- [ ] **Step 6: Run all tests + typecheck**

Run: `pnpm typecheck && pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 7: Browser verify — rotate 90°, draw a shape, check position matches cursor**

- [ ] **Step 8: Commit**

```bash
git add packages/image-editor/src/utils/geometry.ts packages/image-editor/src/canvas/EditorCanvas.tsx packages/image-editor/src/__tests__/geometry.test.ts
git commit -m "fix(image-editor): shape offset after rotation — use canvasSpaceToImageSpace"
```

---

### Task 3: Crop bounds constrained to image area

**Files:**
- Modify: `packages/image-editor/src/utils/geometry.ts`
- Modify: `packages/image-editor/src/canvas/EditorCanvas.tsx`

- [ ] **Step 1: Add `transformPoint` and `transformRect` to geometry.ts**

```typescript
export function transformPoint(
  x: number, y: number,
  width: number, height: number,
  rotation: number, flipX: boolean, flipY: boolean,
  inverse = false,
): { x: number; y: number } {
  // Forward: rotation then flip. Inverse: un-flip then un-rotate.
  // ... (see spec for details)
}

export function transformRect(
  rect: CropRect,
  originalWidth: number, originalHeight: number,
  rotation: number, flipX: boolean, flipY: boolean,
  inverse = false,
): CropRect {
  // Project all 4 corners through transformPoint, find bounding box
  const corners = [
    transformPoint(rect.x, rect.y, ...),
    transformPoint(rect.x + rect.width, rect.y, ...),
    transformPoint(rect.x, rect.y + rect.height, ...),
    transformPoint(rect.x + rect.width, rect.y + rect.height, ...),
  ];
  return { x: min(xs), y: min(ys), width: max(xs)-min(xs), height: max(ys)-min(ys) };
}
```

- [ ] **Step 2: Update `cropSessionBounds` in EditorCanvas.tsx**

When `state.transform.crop` exists, project it into working space:
```typescript
const cropSessionBounds = useMemo(() => {
  if (state.transform.crop) {
    return transformRect(
      state.transform.crop,
      state.originalWidth, state.originalHeight,
      state.transform.rotation, state.transform.flipX, state.transform.flipY,
    );
  }
  return { x: 0, y: 0, width: workingDimensions.width, height: workingDimensions.height };
}, [state.transform, state.originalWidth, state.originalHeight, workingDimensions]);
```

- [ ] **Step 3: Add `cropFitBounds` and update `getCropFrameRect` signature**

```typescript
const cropFitBounds = useMemo(() => ({
  x: (stageSize.width - cropSessionBounds.width * cropFitScale) / 2,
  y: (stageSize.height - cropSessionBounds.height * cropFitScale) / 2,
  width: cropSessionBounds.width * cropFitScale,
  height: cropSessionBounds.height * cropFitScale,
}), [cropFitScale, cropSessionBounds, stageSize]);

// Change getCropFrameRect(stageWidth, stageHeight, ratio) to:
function getCropFrameRect(imageBounds: CropRect, aspectRatio: number): CropRect {
  const safePadding = Math.min(44, Math.min(imageBounds.width, imageBounds.height) * 0.08);
  // ... use imageBounds.x/y for offset
}
```

- [ ] **Step 4: Inverse-transform `SET_PENDING_CROP` back to original space**

In the crop dispatch effect, before dispatching:
```typescript
const originalSpaceCrop = transformRect(
  nextCrop,
  state.originalWidth, state.originalHeight,
  state.transform.rotation, state.transform.flipX, state.transform.flipY,
  true, // inverse
);
dispatch({ type: 'SET_PENDING_CROP', crop: originalSpaceCrop });
```

- [ ] **Step 5: Run all tests + typecheck**

Run: `pnpm typecheck && pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 6: Browser verify — crop tool, crop frame stays within image bounds**

- [ ] **Step 7: Commit**

```bash
git add packages/image-editor/src/utils/geometry.ts packages/image-editor/src/canvas/EditorCanvas.tsx
git commit -m "fix(image-editor): constrain crop area to image bounds"
```

---

### Task 4: annotation-bounds — replace `projectPoint` with `imageSpaceToCanvasSpace`

**Files:**
- Modify: `packages/image-editor/src/utils/annotation-bounds.ts`
- Modify: `packages/image-editor/src/canvas/SelectionActionsOverlay.tsx`
- Modify: `packages/image-editor/src/canvas/EditorCanvas.tsx`

- [ ] **Step 1: Add `originalHeight` to `DisplayProjectionOptions` interface**

In `annotation-bounds.ts`, add `originalHeight: number` to the interface.

- [ ] **Step 2: Update `SelectionActionsOverlay` to accept and pass `originalHeight`**

Read `SelectionActionsOverlay.tsx`. Add `originalHeight` prop. Pass it through to `getAnnotationDisplayBounds`.

- [ ] **Step 3: Update `EditorCanvas.tsx` to pass `originalHeight` to `SelectionActionsOverlay`**

Find the `<SelectionActionsOverlay>` JSX (around line 800-813). Add `originalHeight={state.originalHeight}`.

- [ ] **Step 4: Replace `projectPoint` with `imageSpaceToCanvasSpace` in `getAnnotationDisplayBounds`**

```typescript
import { imageSpaceToCanvasSpace } from './geometry';
import type { Transform } from '../types';

// Inside getAnnotationDisplayBounds:
const transform: Transform = {
  rotation: options.rotation,
  flipX: options.flipX,
  flipY: options.flipY,
  crop: { x: options.cropX, y: options.cropY, width: ..., height: ... },
};
const projected = corners.map(corner =>
  imageSpaceToCanvasSpace(corner.x, corner.y, options.displayWidth, options.displayHeight, options.originalWidth, options.originalHeight, transform)
);
```

Remove the old `projectPoint` function.

- [ ] **Step 5: Run all tests + typecheck**

Run: `pnpm typecheck && pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 6: Browser verify — select annotation after rotation, selection pill in correct position**

- [ ] **Step 7: Commit**

```bash
git add packages/image-editor/src/utils/annotation-bounds.ts packages/image-editor/src/canvas/SelectionActionsOverlay.tsx packages/image-editor/src/canvas/EditorCanvas.tsx
git commit -m "fix(image-editor): annotation-bounds use imageSpaceToCanvasSpace for correct transform order"
```

---

### Task 5: Visual overhaul — translucent modal + glass morphism

**Files:**
- Modify: `packages/image-editor/src/style.css`
- Modify: `packages/image-editor/src/canvas/EditorCanvas.tsx`

- [ ] **Step 1: Remove checkerboard div from EditorCanvas.tsx**

Find and remove `<div className="inkio-ie-stage-checkerboard" />` (around line 771).

- [ ] **Step 2: Update modal backdrop in style.css**

Change `.inkio-ie-modal-content`:
```css
.inkio-ie-modal-content {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
}
```

- [ ] **Step 3: Remove `.inkio-ie-stage-checkerboard` CSS**

Delete the `.inkio-ie-stage-checkerboard` rule block.

- [ ] **Step 4: Verify glass morphism consistency on toolbar/dock/zoom**

Check that `.inkio-ie-desktop-rail`, `.inkio-ie-bottom-dock`, `.inkio-ie-top-zoom-cluster` all have consistent glass treatment: `backdrop-filter: blur()`, semi-transparent bg, subtle border. Adjust if inconsistent.

- [ ] **Step 5: Run typecheck + test**

Run: `pnpm typecheck && pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 6: Browser verify — page visible behind modal, glass on all chrome elements**

- [ ] **Step 7: Commit**

```bash
git add packages/image-editor/src/style.css packages/image-editor/src/canvas/EditorCanvas.tsx
git commit -m "feat(image-editor): translucent overlay modal with glass morphism"
```

---

### Task 6: Toolbar always-on + default crop tool

**Files:**
- Modify: `packages/image-editor/src/hooks/use-image-editor-session.ts`
- Modify: `packages/image-editor/src/hooks/use-keyboard-shortcuts.ts`
- Modify: `packages/image-editor/src/ImageEditor.tsx`

- [ ] **Step 1: Read `use-image-editor-session.ts` and find toggle-off logic**

Read lines 130-155. Find where `currentTool === nextTool` triggers `closeChrome()`.

- [ ] **Step 2: Change toggle-off to no-op**

When `currentTool === nextTool`, return early (no-op) instead of calling `closeChrome()`.

- [ ] **Step 3: Read `use-keyboard-shortcuts.ts` and find Escape handler**

Read lines 30-40. Find where Escape dispatches `SET_TOOL, tool: null`.

- [ ] **Step 4: Change Escape to set default tool**

Change Escape handler: instead of `tool: null`, set `tool: 'resize'`.

- [ ] **Step 5: Set default tool in ImageEditor.tsx**

Read `ImageEditor.tsx`. Find where `defaultTool` or initial tool is configured. Ensure the editor opens with `'resize'` tool active.

- [ ] **Step 6: Run all tests + typecheck**

Run: `pnpm typecheck && pnpm --filter @inkio/image-editor test`
Expected: All pass

- [ ] **Step 7: Browser verify**

- Open image editor → resize/crop tool active by default
- Click active tool → nothing happens (no deactivation)
- Press Escape → goes to resize tool (not empty)
- Options bar always visible
- Switch between tools → options bar updates, never disappears

- [ ] **Step 8: Commit**

```bash
git add packages/image-editor/src/hooks/use-image-editor-session.ts packages/image-editor/src/hooks/use-keyboard-shortcuts.ts packages/image-editor/src/ImageEditor.tsx
git commit -m "fix(image-editor): toolbar always visible, default resize tool, no toggle-off"
```

---

### Task 7: Final verification + bottom dock height fix

**Files:**
- Modify: `packages/image-editor/src/style.css`

- [ ] **Step 1: Fix dock height consistency**

Change `.inkio-ie-bottom-dock`:
- `min-height` → `height` (fixed height)

Add `.inkio-ie-bottom-dock-scroll`:
- `display: flex; align-items: stretch; min-height: 0;`
- `overflow-x: auto; overflow-y: hidden; scrollbar-width: none;`

Update `.inkio-ie-tool-controls[data-viewport-kind='desktop'] .inkio-ie-control-card`:
- `min-height: 100%` → `height: 100%`

- [ ] **Step 2: Run full verification pipeline**

```bash
pnpm typecheck && pnpm test && pnpm build
```
Expected: All pass

- [ ] **Step 3: Browser verify — switch between all tools, dock height stays constant**

- [ ] **Step 4: Commit**

```bash
git add packages/image-editor/src/style.css
git commit -m "fix(image-editor): consistent bottom dock height across tools"
```
