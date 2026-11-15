# Direct editing follow-up delta verification

Status: both blockers from `direct-editing-followup-gate-review.md` are resolved.
This is executor verification after that review. The original report preserves
the earlier reviewed state and its REJECT verdict.

## Corrections

- C-PRESERVE-CROP: `RESET_RESIZE_SESSION` in
  `packages/image-editor/src/reducer.ts` now seeds the crop using original image
  width/height. Displayed dimensions still use the retained rotation.
  The existing Reset regression now covers 0, 90, 180, and 270 degrees and the
  committed final dimensions. A real-browser row saves the complete rotated
  560x360 fixture as 360x560.
- C-LIVE-RESIZE: `ResizeOptions.tsx` captures the current ratio on the first
  valid input in a focus gesture and reuses it across intermediate integer
  outputs. Width typing 2, 0, 0 gives 2x1, 20x13, 200x129 on the 560x360
  fixture; height typing gives 3x2, 31x20, 311x200. Every valid digit applies
  before blur. Both rows check the saved PNG dimensions.
- Runtime verification exposed deferred popover autofocus stealing the height
  field after its first digit. `review-focus-race.json` records the native
  height input followed by unexpected width focus. `OptionPopover.tsx` now
  preserves focus already inside the popover. Browser rows assert retained
  focus after every digit as well as dimensions. No artificial delay or
  forced focus was added to bypass the failure.

## Evidence

Root: `/tmp/inkio-followup-1794693430854/`.

- `review-red.log`: four failures before the corrections, covering both
  quarter turns and sequential input in both dimensions.
- `review-final-build.log`: all 201 image-editor tests pass; package tsc,
  declarations, dual JavaScript build, budgets, and final Next build pass.
  Raw JavaScript is 251956/252000 bytes.
- `review-final-browser.log`: one process, one worker, 56/56 cases pass across
  Chromium and Firefox, including all previous 50 cases and the six added
  browser cases. No timeouts, retries, skips, or assertions were weakened.
- `review-final-manual.json`: real 560x320 photo, desktop width typing gives
  2x1, 20x11, 200x114; phone height typing gives 4x2, 35x20, 350x200. Every
  digit retains focus, and saved PNG dimensions match. Desktop and phone
  rotated Reset both retain source crop 560x320 and save 320x560.
- `review-locked-1440.png`, `review-locked-390.png`,
  `review-reset-1440.png`, and `review-reset-390.png` retain actual final
  controls and photo frames. Desktop locked typing and phone rotated Reset
  were visually inspected at full resolution. Saved rotated PNG bytes are
  `review-reset-saved-1440.png` and `review-reset-saved-390.png`.
- `final-source-hashes.json` records SHA-256 for 99 source/style/test files
  before the final browser run. Subsequent changes only update documentation
  and evidence.
- Earlier `unit-types.log` proves the 892-case workspace run and all workspace
  typechecks. The latest 201-case image-editor run includes six additional
  cases relative to that workspace run, for 898 unique verified cases across
  runs. Earlier example/public-package gates remain recorded in `build.log`;
  package entries and dependencies did not change.

## Review and limits

The executor inspected the corrected source coordinate domain, stable ratio
lifecycle, focus callback forwarding, and deferred focus ownership. The crop
and ratio fixes use the existing projection and numeric input, with no new
parallel implementation or dependency. The focus correction directly removes
the reproduced race. All original gate findings have corresponding state and
runtime evidence; no blocker is deferred.

Earlier desktop/mobile light/dark captures, direct text, IME guard, actual
pointer/canvas/export pixel registration, history, asynchronous save, and
44px mobile targets retain their evidence and passing final browser rows.
Physical mobile keyboards and Safari were not tested. LSP is unavailable;
the package compiler provides type diagnostics. Existing Vite loader and
unrelated core CJS build warnings remain unchanged.
