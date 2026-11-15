# Direct editing follow-up final gate review

recommendation: REJECT

Review date: 2026-11-14. Reviewed local follow-up over HEAD 3037e28, keeping the already approved compact redesign as baseline. No source edits, commits, installs, releases, additional reviewers, builds, or settled test-suite reruns. The only workspace write by this reviewer is this report. Two new focused browser probes used the already running production preview at localhost:4174; their final receipts are included below.

originalIntent: Identify and normalize the odd preview font, remove the selected 2px left-navigation stripe, enter text directly on the image, apply integer resize dimensions immediately while typing, and eliminate annotation/pointer drift after resize and zoom.

desiredOutcome: Keep the accepted compact shell and all previous tools/options, crop/resize/rotation/flip, annotation/export registration, asynchronous save/retry, undo, keyboard/IME, themes, and mobile targets. Introduce no dependencies or release actions.

userOutcomeReview: The font, left stripe, native on-image text entry, and shared per-axis annotation mapping are implemented and supported by inspected source and artifacts. Dimension input accepts replaceable drafts and immediately applies integer results. However, the default aspect lock does not hold across the newly supported sequential typing flow, and the rotated crop correction leaves Reset feeding rotated dimensions into an original-coordinate consumer. The latter visibly discards part of the image and saves a square. These are concrete failures in the requested resize/crop behavior, not a request for a different design.

## Blockers, ordered by severity

### P1: C-PRESERVE-CROP - Reset after a quarter turn discards image content

violatedCriterion: C-PRESERVE-CROP. The task explicitly requires preservation of crop/resize/rotation. DESIGN.md's brief requires preserving every option and crop draft; its follow-up requires a shared correct projection after crop and rotation.

evidencePointer:
- packages/image-editor/src/reducer.ts:177-208, RESET_RESIZE_SESSION: resetSize is computed through getTransformedDimensions with the current rotation, then resetCrop is seeded with resetSize.width/height.
- packages/image-editor/src/canvas/EditorCanvas.tsx:146-155: sourceCrop is now treated as original-image coordinates and projected through transformRect. Lines 287-307 inverse-project the clamped viewport back into those original coordinates.
- packages/image-editor/src/toolbar/options/ResizeOptions.tsx:119-123 exposes the real Reset action.
- This report's "Settled rotated Reset probe" receipt below records the actual control values, crop, and saved PNG dimensions.

Observation: With the standard 560x360 fixture, rotate clockwise, return to Resize, then Reset. Before Reset the dimensions are correctly 360x560 and pendingCrop is the original 560x360 rectangle. After Reset, pendingCrop becomes 360x360, dimensions become 360x360, and Save produces a 360x360 PNG. Reset should restore the complete rotated image, 360x560. The original-space crop fix was applied to session entry but not to the Reset seeding path.

Required correction: Seed Reset's pending crop in original-image coordinates while retaining rotated display/output dimensions. Add the quarter-turn Reset row to the existing crop/reset regression owner and check actual saved full-frame dimensions.

### P2: C-LIVE-RESIZE - Sequential typing changes the locked aspect ratio

violatedCriterion: C-LIVE-RESIZE together with C-PRESERVE-OPTIONS. The user explicitly requires immediate integer resizing while typing and preservation of existing resize options; DESIGN.md requires every existing option to remain available. The default enabled "Lock aspect ratio" must continue to describe the operation performed during that typing flow.

evidencePointer:
- packages/image-editor/src/toolbar/options/ResizeOptions.tsx:28-41 and :56-70: every input event derives the ratio from the previous, already rounded resizeOptions values.
- packages/image-editor/src/toolbar/control-groups.tsx:276-286: each valid typed draft calls onChange immediately with a rounded integer.
- packages/image-editor/src/constants.ts:146-150: lockAspectRatio defaults to true.
- e2e/image-editor.spec.ts:468-470: the new projection regression explicitly turns the lock off and fills whole values; it cannot catch sequential locked typing.
- This report's "Settled locked typing probe" receipt below records real native keystrokes, enabled lock, and applied outputs.

Observation: Clear Width on the 560x360 fixture and type 2, 0, 0 with the lock enabled. Applied dimensions advance through 2x1, 20x10, and 200x100. The original locked ratio requires 200x129 after integer rounding. The intermediate 2x1 result becomes the ratio for the next keystroke, permanently changing the locked ratio. The symmetric height handler has the same cause. This finding describes the current requested typing flow; it does not claim the arithmetic was first introduced by this follow-up.

Required correction: Retain a stable ratio for the dimension-edit gesture instead of deriving it from each rounded intermediate output. Cover real sequential typing with the lock enabled, including the final applied dimensions; do not defer valid resizing until blur.

## Direct review of the five fixes and preservation constraints

- Font: examples/next-app-router/app/globals.css:6 uses system-ui, sans-serif. The diff identifies the previous Avenir Next host stack; library CSS continues to inherit its host. final-captures.json records the computed system-ui font in all eight width/theme combinations.
- Left mark: the selected desktop tool rule at style.css:233-237 uses a muted background and transparent border without the former selected-edge pseudo-element. Both contact sheets show the stripe absent. The retained mobile selected underline is a different navigation state and is outside the explicitly identified left-edge request.
- Direct text: read the complete new CanvasTextEditor.tsx, TextAnnotationShape.tsx, AnnotationRenderer.tsx, and the EditorCanvas lifecycle. The native textarea uses the actual Konva text absolute matrix, a 16px native font floor and inverse scale, shared font/style/color, auto-height, blur commit/empty deletion, and composition-aware Escape/Ctrl-or-Cmd+Enter. The canvas receives focus after completion and Enter reopens selected text. Existing text is reopened by double click/tap. TextOptionsPanel retains formatting and removes the separate content editor. Inspected text screenshots show transparent multiline Korean text on the photograph without another content box.
- Immediate dimensions: DimensionInput has a replaceable local draft, rejects nonpositive/nonfinite input at the input boundary, rounds valid values, and invokes the live commit path. commitResizeSession is reused by save projection and stores pre-global-rotation output dimensions. C-LIVE-RESIZE above remains a blocking correctness issue for the locked flow.
- Drift: getAnnotationScale now returns independent axes. DesignLayer, imperative freedraw preview, selection bounds/actions, and export use the same X scaling plus parent Y stretch and crop offset. The pointer inverse uses the same image/crop dimensions. Exact quarter turns avoid boundary roundoff. The new browser oracle samples actual red pixels in the canvas and exported PNG; expectations are pointer-input fractions, not production geometry helpers. Creation and drag after unequal-axis resize, both zoom orders, and rotated cropping have raw passing cases. The Reset source-space mismatch above remains a blocking crop lifecycle path.
- History: read the generic preview checkpoint handling and regressions for creation, tiny/empty cancellation, property gestures, separate gestures, unfinished text, and resize. Atomic text ADD/select retains one creation-and-typing undo gesture; the direct browser case exercises Undo/Redo and keyboard re-entry.
- Save/retry: read use-image-editor-session.ts and its changed failure regression. The same resize projection is used for preview/save; persistence is awaited before committing the draft, and failed persistence retains crop/dimensions for retry. The changed regression first establishes 320x240 before failure, then asserts unchanged dimensions and retained crop, and verifies retry cleanup. This is stronger than merely changing the post-failure expected literal.
- Accessibility/mobile/themes: the native textarea is labeled; canvas re-entry has a focusable labeled group and visible focus ring. Existing keyboard shortcuts leave inputs and composition alone. The final browser log retains phone 44px Delete/discard cases in both engines. Final photo/text contact sheets show all four widths in both themes with no blank or overlapping shell; final-captures.json records root/scroll dimensions equal to the viewport and restored focus. Physical mobile virtual-keyboard behavior is not independently reproduced here.
- Constraints: no manifest/lockfile changes are present in the inspected diff/status. The budget policy explicitly permits a justified increase; the feature justification is recorded in scripts/check-budgets.mjs and DESIGN.md. The raw final measured budget is 251525/252000 bytes. No dependency or framework addition was found. No commit/release action was performed by this reviewer.

## Direct programming and remove-ai-slops pass

Loaded both installed skills and the TypeScript, testing, and junk-class references before judging the source/tests. Applied their review criteria directly. Their edit, refactor, mutation, and delegation workflows were not executed because this task authorizes only a gate artifact and forbids source edits and additional reviewers.

The added/reshaped follow-up tests are retained (R) for concrete owner contracts: final resize dimensions and one undo gesture; original-coordinate cropping after a quarter turn; atomic text creation/selection; unequal-axis selection bounds; exact crop boundary round-trip; real native direct text preview/commit; failed-save draft retention/retry; canvas/PNG pixel registration; direct text placement, keyboard/focus/history/multiline/composition; and empty-entry cleanup. Previously approved history/layout/mobile tests remain baseline.

No excessive/useless, deletion-only, requested-removal certificate, prose pin, source-grep, copied-inventory, tautological, fabricated-postcondition, or cannot-fail test was found in those follow-up changes. The geometry round-trip asserts an independent exact-boundary invariant; the saved PNG expectations are not computed using the production projection. Empty cancellation asserts scene cleanliness and disabled Undo, rather than only absence of a DOM input. Preview/commit dispatch assertions in the existing component test are a narrow context adapter boundary; real-browser tests own focus, placement, and rendering. The new reducer and browser tests cover distinct state-machine and platform risks, rather than replaying identical geometry at wrappers. No new test-only production seam, timeout/retry increase, or weakening of pixel/export assertions was found.

The test problem is missing input classes: current new browser rows disable aspect lock and use whole-value fill, and Reset coverage uses rotation 0. Passing totals consequently do not establish the two failed behaviors above.

Production fit: the native platform textarea is appropriate; the shared resize commit removes a separate save projection, and the existing projection utility now serves painting, live drawing, bounds, and export. No unnecessary new parsing/normalization pipeline or single-use extraction was found in the follow-up. Boundary handling remains in the number input and native text handlers. The missed Reset caller is a concrete shared-contract defect. The existing large reducer/canvas/CSS/spec modules and established assertions/type casts remain maintenance notes, not independent product blockers or a reason for a broad refactor.

Separate code-review report perspective coverage: UNCONFIRMED. No separate follow-up code-review report or notepad path was supplied, and the inspected .omo/evidence directory contained only the two baseline gate reports. Those baseline reports explicitly document their programming/remove-ai-slops checks and the same junk-test classes, but do not substitute for a follow-up report. This reviewer performed the follow-up pass directly. This missing report is an evidence limit, not a product blocker.

## Raw recorded verification inspected

- /tmp/inkio-followup-1794693430854/unit-types.log: 135 files, 892 tests passed; all ten listed package/docs/example typecheck tasks report Done.
- /tmp/inkio-followup-1794693430854/verified-build.log: latest 28 image-editor files / 196 tests passed, tsc, dual-format package/declaration build, budget 251525/252000, and completed Next production build.
- /tmp/inkio-followup-1794693430854/build.log: earlier example smoke builds complete, all six publint results are All good, and all six attw entries are clean.
- /tmp/inkio-followup-1794693430854/final-browser.log: one worker, all 50 named Chromium/Firefox cases pass, 2.7 minutes.
- /tmp/inkio-followup-1794693430854/final-captures.json: eight viewport/theme records, computed font, exact root/scroll sizes, native input font sizes, restored keyboard focus, and 560x320 saved output dimensions.
- /tmp/inkio-followup-1794693430854/large-image-input.json: nativeFont 16px and viewportScale 1. The JSON does not itself encode the claimed 2000x1500 source dimensions.

These raw files establish recorded passing runs; they do not override the independently reproduced failures. No settled suite or build was rerun.

## Reviewer browser receipts

Both final probes used the existing Next production preview, real trusted clicks/keystrokes, and state-transition assertions, without rebuilding or editing files. They did not invoke the Playwright suite or its shared test-results directory. Browser contexts were closed.

### Settled locked typing probe

Wait for the ready fixture, original pending crop and 560 x 360 dimensions. Open the real dimensions popover. Clear Width; press 2, 0, 0 separately. After each keystroke, wait for the harness applied output to settle before recording values.

```json
{"probe":"locked per-keystroke resize, settled","source":[560,360],"lock":"true","sequence":[{"width":"2","height":"1","output":"2x1"},{"width":"20","height":"10","output":"20x10"},{"width":"200","height":"100","output":"200x100"}],"expectedFinal":[200,129]}
```

### Settled rotated Reset probe

Wait for ready/original crop. Click Rotate, clockwise, then Resize. Wait for the dimensions trigger to read 360 x 560. Click Reset and wait for its resulting 360 x 360 state. Save, wait for the actual saved image, then read naturalWidth/naturalHeight.

```json
{"probe":"quarter-turn resize reset, settled","beforeReset":{"crop":"{\"x\":0,\"y\":0,\"width\":560,\"height\":360}","dimensions":"360 × 560"},"afterReset":{"crop":"{\"x\":0,\"y\":0,\"width\":360,\"height\":360}","dimensions":"360 × 360"},"exported":[360,360],"expectedFullRotated":[360,560]}
```

Probe bookkeeping: preliminary reads before React state settled are excluded. One combined probe successfully recorded the settled locked-typing receipt, then stopped because this reviewer used a nonexistent rotation test id. That locator failure is not a product finding. The separate final Reset probe above uses the actual dimensions control and completes successfully. Settled successful results were not rerun.

## Checked artifact paths

- packages/image-editor/DESIGN.md and packages/image-editor/AGENTS.md.
- .omo/evidence/compact-image-editor-gate-review.md and compact-image-editor-delta-gate-review.md (accepted baseline and limits).
- /tmp/inkio-followup-1794693430854/current.diff, qa.json, unit-types.log, verified-build.log, build.log, final-browser.log, final-captures.json, large-image-input.json.
- /tmp/inkio-followup-1794693430854/final-contact.png and final-text-contact.png (visually inspected all sixteen constituent states).
- examples/next-app-router/app/globals.css; examples/next-app-router/components/image-editor-e2e-harness.tsx (literal harness ownership lookup).
- packages/image-editor/src/canvas/CanvasTextEditor.tsx, EditorCanvas.tsx, DesignLayer.tsx, SelectionActionsOverlay.tsx.
- packages/image-editor/src/annotations/AnnotationRenderer.tsx and TextAnnotationShape.tsx.
- packages/image-editor/src/reducer.ts, ImageEditorContext.tsx, constants.ts, style.css.
- packages/image-editor/src/hooks/use-image-editor-session.ts and use-keyboard-shortcuts.ts; hooks/__tests__/use-image-editor-session.test.tsx follow-up diff.
- packages/image-editor/src/toolbar/control-groups.tsx; options/ResizeOptions.tsx and TextOptionsPanel.tsx; options/__tests__/SelectionInspector.test.tsx.
- packages/image-editor/src/utils/geometry.ts, annotation-bounds.ts, export-canvas.ts, text-metrics.ts, crop.ts; corresponding changed geometry/bounds tests.
- packages/image-editor/src/__tests__/reducer.test.ts and e2e/image-editor.spec.ts.
- scripts/check-budgets.mjs and playwright.config.ts.
- Installed remove-ai-slops/SKILL.md and programming/SKILL.md plus references/typescript/README.md, references/testing/README.md, references/testing/junk-classes.md under /Users/mini/.bun/install/global/node_modules/omo-ai/plugin/skills/.

## Exact evidence gaps and residual limits

1. No separate follow-up code-review report or notepad was supplied; its perspective coverage cannot be certified.
2. The reported pre-fix red reproductions and CDP Korean composition session are described in qa.json by receipt names/prose, without separate raw red/IME transcripts. The composing Escape regression is independently present in browser source and the passing final-browser log; this reviewer does not claim to have reproduced the full Korean IME session.
3. The logs contain completed successful output but no source hashes tying every original run to exact worktree bytes. The latest browser preview matched the reviewed behavior for the targeted probes. Broader test/build provenance relies on the retained executor artifacts; no settled checks were rerun as instructed.
4. The total 893 unique unit cases is derived from the earlier 892 plus the reported additional text-gesture case. There is no single raw 893-case workspace run; the latest raw owner run proves all 196 image-editor cases pass. No contrary failure is inferred from that sequencing.
5. Contact sheets and JSON were inspected, but individual full-resolution screenshots, saved manual PNG bytes, Safari/physical mobile virtual keyboards, and every annotation type/transform combination were not independently re-exercised here. No unrequested platform criterion is inferred.
6. Existing Vite __dirname and unrelated core CJS warnings appear in the raw logs. They were not investigated, as instructed. git diff --check was executor-reported and was not repeated. No diagnostics were rerun because no source changed in this review.
7. An attempted context read at src/context.tsx returned ENOENT; the actual ImageEditorContext.tsx was subsequently read. No absent file was treated as product evidence.
8. SDK status was queried through the available Bun CLI (the specified JS eval tool is not exposed to this child). It returned ULW_LOOP_PLAN_MISSING for this child, so no currentAttemptDir exists. This report uses the distinct authorized fallback under .omo/evidence/.

blockers:
- violatedCriterion: C-PRESERVE-CROP
  evidencePointer: packages/image-editor/src/reducer.ts:177-208; packages/image-editor/src/canvas/EditorCanvas.tsx:146-155,287-307; this report, Settled rotated Reset probe.
- violatedCriterion: C-LIVE-RESIZE / C-PRESERVE-OPTIONS
  evidencePointer: packages/image-editor/src/toolbar/options/ResizeOptions.tsx:28-41,56-70; packages/image-editor/src/toolbar/control-groups.tsx:276-286; this report, Settled locked typing probe.
