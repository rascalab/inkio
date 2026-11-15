# Live gestures and glass correction

The user reported that the reference's translucent material treatment was
missing and that movement/resizing did not visibly update during gestures.

## Causes and corrections

- Native text input derived its bounds only from committed annotation data.
  It now observes live Konva transform/drag events. Text boxes update their
  child geometry during transforms so wrapping changes immediately, while the
  final document and undo history are committed once per gesture.
- Selection actions used persisted geometry and duplicated projection math.
  They now follow the selected node's live client bounds, including its parent
  transforms, without rerendering the whole editor for every pointer move.
- Redaction retained the old sampled source region during a drag. It now
  samples current node geometry, coalescing filter rasterization to one update
  per animation frame.
- Opaque chrome hid the image-backed depth of the supplied reference. A static
  photo backdrop and translucent header/navigation/popover surfaces restore
  that material treatment while keeping the compact layout and sharp canvas.

## Proof

- The new intermediate text-bounds assertion failed on the prior implementation
  with a 40px error before pointer release.
- Removing the selection-action event subscription makes the new movement
  assertion fail with a 40px error.
- Removing redaction's event subscription makes the pixel assertion fail:
  the old yellow region remains instead of the current blue source region.
- After restoring the subscriptions, all 74 production cases pass in Chromium
  and Firefox. Coverage includes movement/resizing before pointer release and
  a single-step undo of movement.
- Native Chromium touch events produce a 24px horizontal and 17.984375px
  vertical size change before touch end, with input focus retained.
- All eight tools were captured on desktop and emulated mobile, light and dark:
  32 real-photo captures; no editor overflow.
- Touch-edited photo export is 560 x 320 PNG. Original and saved corner pixel
  are both `[11, 24, 17, 255]`; backdrop styling does not enter the output.
- Typecheck, 201 image-editor unit tests, declarations, dual package build,
  production Next example build, publint and attw pass.
- Package JavaScript is 251609/252000 bytes, with no new dependencies or budget
  increase in this correction.

The first full browser run caught backdrop scaling expanding the scroll
extent by 36 x 20px. Removing that scale fixed the cause; both engines then
passed the viewport checks and the final full suite.

## Evidence and limits

Artifacts are in `/tmp/inkio-live-glass-1794731834086/`: the original reference,
before and final screenshots, `visual-matrix.json`, `native-touch.json`,
`photo-export.json`, and the actual exported PNG.

The existing core CJS build warning remains. Safari, physical touch hardware,
and physical mobile keyboards were not tested.
