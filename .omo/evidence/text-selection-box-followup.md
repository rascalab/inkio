# Text selection-box follow-up

The requested resize box is restored during direct text entry. The existing
Konva transformer supplies its border and handles; there is no parallel
resizer, new property panel, dependency, or budget increase.

## Cause and correction

- `EditorCanvas.tsx` cleared the transformer selection whenever inline text
  editing was active. Selection now stays attached outside crop mode.
- Handle mousedown previously blurred native text entry, deleting an empty
  box and ending populated input. The DOM handler now preserves native focus
  while the existing transformer reports an active gesture.
- Geometry changes during inline editing reuse the annotation preview
  transaction. Escape on an empty resized box restores the clean scene.
- Group child changes require refreshing the existing transformer. Native
  layout now refreshes it alongside the input projection.
- `TextAnnotationShape.tsx` retained a stale measured height despite already
  assigning an explicit text height. The hit rectangle now uses that explicit
  scaled height directly, so height-only shrinking works.

## Verified evidence

Root: `/tmp/inkio-text-resize-1794703443271/`.

- `red.log`: the original selection layer was transparent during entry;
  the real-browser regression failed for missing painted handles.
- `final-build.log`: 201 image-editor unit tests pass; package tsc,
  declarations, dual JavaScript and Next builds pass. Raw JavaScript is
  251809/252000 bytes under the unchanged budget.
- `browser.log`: all 66 Chromium/Firefox cases pass with one worker.
  Added rows cover empty and populated entry at 1440/390px, real anchor
  dragging, retained native focus, exact geometry deltas, actual painted
  border edges aligned with the input, continued typing, and empty resized
  cancellation. No timeout, skip, retry, or weakened assertion was added.
- `before-<width>-<theme>.png`, `after-<width>-<theme>.png`, and
  `resized-<width>-<theme>.png`: matched real-photo cases at 1440/390px and
  both themes. Full-resolution desktop light and phone dark final captures
  were visually inspected. `final-checks.json` records retained focus, text
  geometry and four actual saved 560x320 images, with no page errors.
- `height-shrink-before.png` and `height-shrink-after.png`: the stale
  height-only border and its correction.
- `gesture-checks.json` and `touch-dev.png`: native Chromium touch-event
  resizing retains focus and permits immediate continued entry; empty mouse
  resizing followed by Escape leaves a clean scene and disabled Undo.

The executor reviewed the changed text projection, existing transformer
ownership, preview lifecycle, explicit height, and regressions. Existing
shell, formatting, composition and save behavior retain their passing rows.
Physical phone keyboards and Safari remain untested; existing build warnings
are unchanged. No commits or release actions were performed.
