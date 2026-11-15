# Compact image editor final gate review

recommendation: REJECT

Review date: 2026-11-14. Base: `3037e28`. Reviewed the current local uncommitted tree, including the five untracked implementation/test/design additions. No source was modified, no panel was spawned, and no build or test was rerun. The only write is this report.

## Original intent and desired outcome

originalIntent: Replace the bulky editor with a clean, compact image workbench inspired by edit.photo. The user's binding correction rejects the persistent bottom PROPERTIES/options sheet entirely, including shortened versions.

desiredOutcome: A 76px desktop tool rail, save/history/zoom at the top, shallow transparent contextual commands above the photograph, and bounded details popovers. Mobile keeps bottom tool navigation only. Preserve all eight tools, their controls, crop/resize, annotations, layer ordering, property undo/redo, zoom/Fit, keyboard access, theme tokens, and asynchronous save/retry without additional dependencies or release actions.

userOutcomeReview: The principal redesign is delivered. The six contact sheets show a quiet left rail on desktop and options above the image on mobile, with no reserved bottom properties sheet. The real-photo captures show that the photograph dominates. The recorded laptop resize stage grows from 952x290 to 876x668; the wide resize stage grows from 1048x888 to 1316x948. All 48 standard capture records place the options above the stage and fit the root inside its viewport; all 16 edge records fit their viewport. One explicit mobile sizing criterion remains unmet by actual annotation and discard controls, so the final tree does not yet meet the complete written contract.

## Blockers, ordered by severity

### P2: C-TARGETS — mobile destructive controls remain 34px high

violatedCriterion: `C-TARGETS`, mapped directly to `packages/image-editor/DESIGN.md:62-63`: "mobile interactive controls are at least 44px. Icon size is independent of the hit area."

evidencePointer:

- `packages/image-editor/src/style.css:1234-1252`: `.inkio-ie-selection-action-btn` sets `min-height: 34px`, zero vertical padding, and a 12px font. Its parent has `pointer-events: none`; the button alone receives clicks (`style.css:1214-1232`, `:1247`). Parent padding does not enlarge its hit area.
- `packages/image-editor/src/style.css:1433-1445`: the mobile 44px override omits `.inkio-ie-selection-action-btn`.
- `packages/image-editor/src/canvas/SelectionActionsOverlay.tsx:126-134`: the actual annotation Delete button uses that class without another hit-area wrapper.
- `/tmp/inkio-compact-1794678701473/after/photo-mobile-text.png`: the selected-text mobile state visibly uses this compact Delete button.
- `packages/image-editor/src/style.css:1388-1398`: both discard-confirm buttons also retain `min-height: 34px` with zero vertical padding.
- `packages/image-editor/src/ImageEditorModal.tsx:123-157`: discard controls render outside `.inkio-ie-root`, so simply adding their class to the existing root-scoped mobile selector would not reach them.

Observation: Selecting an annotation on a phone exposes a 34px Delete target. Opening the unsaved-changes confirmation likewise exposes 34px actions. These are existing controls in the redesigned surface and violate the newly stated 44px mobile contract. This is a concrete contract miss, not a request for hypothetical hardening.

Required correction: Give the annotation Delete and both discard actions at least 44px actual mobile hit areas, accounting for the discard card's placement outside the editor root. Keep the current compact layout and no-sheet design. Check these selected/confirmation states at a phone width.

## Other criterion review

- `C-LAYOUT`: PASS by source and visual artifacts. `ImageEditor.tsx` renders one command bar, desktop rail, options bar before the stage, and mobile tool tray after it. `style.css:54-84` uses grid areas with a 76px desktop rail and mobile bottom navigation. The former desktop inspector and separate command/zoom implementations are deleted; their literal names have no remaining source references.
- `C-RESPONSIVE`: PASS for the evidenced default states. Parsed both after manifests: 48 standard records spanning eight tools, three dimensions, and two themes; 16 edge records spanning eight tools at 320x568 and 812x375. No root overflow or commands-below-stage records. Inspected all six contact sheets, both edge screenshots, and four real-photo theme/device captures.
- `C-TOOLS`: No missing tool or control found. Read the current resize, draw, shape, text, filter, redact, sticker, and layer controls. Existing sliders, number fields, color/alpha/hex/palette/eyedropper, text/font/style, filter fine tuning/reset, crop presets, dimensions/lock/apply/reset, rotate/flip, and layer actions remain connected to their existing owners. Selection controls switch to the selected annotation as before.
- `C-CROP`: No concrete correctness failure found in the changed projection. The projection key now incorporates stage geometry and the target crop; a guarded same-component render update reprojects before the effect can publish old viewport geometry into image coordinates. The browser regression preserves pending crop and clean state across desktop/phone resizing, then asserts unchanged save does not create a replacement.
- `C-HISTORY`: No concrete failure found in checkpoint handling. A preview retains the scene before the gesture; repeated updates do not create intermediate entries; final commit consumes the saved checkpoint even when the final value repeats the preview; creation previews become one history entry; discarded tiny creations return to the original scene. Read five added reducer regressions covering creation, tiny deletion, property Undo/Redo, separate gestures, and unfinished text followed by another action.
- `C-POPOVERS`: PASS for the evidenced compositions. `OptionPopover.tsx` reuses core positioning/dismissal, bounds width and height to the editor, observes size/position, supports exclusive opening, autofocus, Escape focus restoration, and dialog labeling. `ColorPickerButton.tsx` reuses this shared implementation rather than maintaining a parallel positioning implementation. The overlay host no longer hides its controls from accessibility APIs.
- `C-KEYBOARD`: No additional blocker found. Read desktop arrow/Home/End navigation and its focus test, native controls and their labels, popover dismissal, and the modal Escape change. Default autofocus in discard confirmation now chooses Cancel. The target-size failure above remains separate.
- `C-SAVE-API`: No save/public API regression found in the diff. Public `src/index.ts`, exported prop types, save session/export logic, and upload cleanup owners are unchanged. Read `use-image-editor-session.ts` and modal save composition: awaited persistence, save lock, failure retention, retry, and commit-after-success remain in place. No manifest or lockfile changes add dependencies.
- `C-CONSTRAINTS`: No source changes outside the editor, browser tests, example harness, and design document were present. No commit/release/attribution additions were found. `git diff --check` completed with exit code 0 during this review.

## Direct programming and remove-ai-slops pass

Loaded both installed skills and the TypeScript/testing/junk-class references from `/Users/mini/.bun/install/global/node_modules/omo-ai/plugin/skills/` before making this assessment. Their implementation/refactor/mutation instructions were not executed because this review expressly permits no source edits or repeated checks.

- Excessive/useless tests: No demonstrated junk test found among the additions. Layout checks assert actual rail/option/stage geometry and viewport containment; they protect the requested visible result rather than CSS spelling. Slider/popover tests drive actual components. The accessibility role test catches the overlay host suppressing descendants. Reducer tests assert usable history states.
- Deletion-only/change-certificate tests: No tests merely grep for the removed sheet or pin the requested deletion. Obsolete right/bottom inspector expectations were replaced with useful image-space geometry assertions. Tests of dismissed controls also assert the modal remains open, so their purpose is dismissal behavior rather than code removal.
- Tautologies/mock echoes/source greps: None introduced. No expected export pixels or geometry were computed from an identical output projection. Existing export luminance, pixel-difference, annotation-boundary, and selection assertions remain in the browser diff.
- Implementation mirrors: Existing debug attributes are used for selected annotation/output state and crop identity, while real clicks, rendered geometry, saved images, focus, and accessibility roles provide behavioral boundaries. No new production-only testing seam was added.
- Assertion preservation: Browser trigger helpers now use trusted `.click()`. The outside-image drag remains outside the image while staying within the browser's event-delivery area; its annotation-boundary assertion survives. Old transition-duration and scroll-shell assumptions were replaced by stable geometry and containment checks that match the new contract. No timeout/retry changes are present in the diff.
- Unnecessary production extraction/parsing/normalization: No new parsing pipeline or normalization layer. Shared popovers consolidate former color-picker positioning/dismissal and serve multiple kinds of controls. The command bar consolidates separate desktop/mobile action implementations. `ToolOptionsBar` replaces the prior chrome wrapper and carries the viewport-specific placement seam.
- Maintenance notes, not blockers: The existing canvas, reducer, CSS, and shared control modules remain large. Read-only counts were 949, 471, 1427, and 422 nonblank/non-line-comment lines respectively. The example harness and browser suite are also large. These are skill-perspective maintenance observations; the user did not request modularization and they do not establish a failed product criterion. Existing catch handling in unchanged color-picker internals is likewise not a new goal failure.

Separate code review report coverage: UNCONFIRMED. No current compact-redesign code review report path or notepad path was provided, and none existed under the supplied evidence directory or workspace `.omo` at inspection. Consequently I cannot attest that a separate report explicitly records the same skill perspectives and junk-test classes. This report records my direct pass; it does not claim an absent prior report exists.

## Checked artifacts and exact evidence limits

Read directly:

- `packages/image-editor/DESIGN.md`, its package `AGENTS.md`, current git diff/status/history, public `src/index.ts`.
- Changed current editor/modal, canvas, reducer, shared toolbar controls, all changed per-tool option modules, color picker, desktop toolbar, mobile tray, tool-options panel, and new `chrome/EditorCommandBar.tsx`, `chrome/ToolOptionsBar.tsx`, `toolbar/OptionPopover.tsx`.
- Changed editor/modal/reducer/selection tests, new `toolbar/__tests__/EditorToolbar.test.tsx`, `e2e/image-editor.spec.ts`, and changed Next example harness.
- Neighboring `ImageEditorContext.tsx`, `hooks/use-image-editor-session.ts`, and `canvas/SelectionActionsOverlay.tsx` to trace history/save/selection contracts.
- `/tmp/inkio-compact-1794678701473/qa.json` including the final update reporting all 19 scenarios per browser, 38 unique Chromium/Firefox cases.
- `/tmp/inkio-compact-1794678701473/after/manifest.json`, `after/edge-manifest.json`, and `before/manifest.json`, parsed for coverage, containment, options placement, and before/after geometry.
- All six `/tmp/inkio-compact-1794678701473/contact-{1440,1000,390}-{light,dark}.png` sheets.
- `after/photo-desktop-dark.png`, `after/photo-mobile-dark.png`, `after/photo-desktop-light.png`, `after/photo-mobile-light.png`, `after/photo-mobile-text.png`, `after/320-color-popover.png`, `after/saved-photo-text.png`, `after/edge-320.png`, `after/edge-812.png`, `after/layers.json`, `after/layer-actions.png`, and `touch-shape.png`.

Evidence limits:

1. Raw terminal output for bash_61/63/66/71/74/75/76/77 was not supplied as a file readable by this child. Unit/build/typecheck/package/browser totals are executor-reported in `qa.json` and the final browser message, not independently reproduced test runs. The instruction forbids rerunning those checks; none were rerun. No browser case remains reported pending in the updated QA artifact.
2. The separate code review report and notepad were not supplied. Their existence/coverage cannot be certified.
3. Screenshots and manifests establish visible states and recorded geometry, not every interaction's execution history. Layer JSON confirms recorded disabled states; source and browser assertions provide complementary behavior evidence. The touch capture predates only the reported overlay accessibility and color-track style refinements.
4. The saved-photo artifact was visually inspected; its encoded PNG dimensions/hash were not independently extracted during this review.
5. An attempted neighboring hook read at `src/hooks/use-undo-redo.ts` returned ENOENT; history ownership was instead traced in the existing `ImageEditorContext.tsx` and reducer.

Artifact placement: SDK status was queried using the provided SDK import. It returned `ULW_LOOP_PLAN_MISSING`; the required fallback path is therefore `.omo/evidence/compact-image-editor-gate-review.md`.

The single blocking finding is the explicit mobile hit-area contract. The absent prior report/raw logs and maintenance observations are recorded evidence limits/notes, not additional product blockers.
