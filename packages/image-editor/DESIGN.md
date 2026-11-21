# Image editor design

## Brief

The editor is a focused image workbench. The photograph is the first thing a
person sees; choosing a tool and adjusting it should require little navigation.
The visual reference is the edit.photo screenshot supplied on November 14, 2026.
Its useful characteristics are a narrow tool rail, quiet monochrome controls,
shallow contextual options, and generous space for the photograph. The user
explicitly rejected a persistent bottom options sheet, including a shortened
version of that sheet.

- Primary action: Save. Apply, reset, history, and navigation remain secondary.
- Information order: photograph, selected tool and its options, save/history.
- Required tools: resize/crop, draw, shapes, text, filter, redact, sticker, rotate.
- Preserve every existing option, selection inspector, layer action, keyboard
  shortcut, crop draft, zoom behavior, and asynchronous save/retry contract.
- Exclude decorative cards, floating pill containers around every group,
  fixed-height empty inspectors, new fonts, and additional UI dependencies.

## Layout

Layout: image workbench - keep a bounded image between fixed navigation and
content-sized options -> holy-grail variant with one narrow rail
(https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/holy-grail.md);
scroll owners: desktop tool rail on short windows, contextual options and
the horizontal filter reel for overflowing controls; the document and photograph
do not become page scrollers. Avoid absolute-positioned inspectors, guessed
per-tool canvas reservations, and multiple vertical scrollers for the same
content.

Desktop uses a top command row (close, history, save), a narrow left tool
rail, and a shallow contextual row above the canvas. The scale ruler and
output dimensions sit below the canvas; the pointer wheel over the canvas
also changes scale. Dimensions, sliders, layers, and detailed adjustments
open bounded popovers only when requested. No side inspector is reserved.

Mobile keeps those same command and scale rows, with a single tool row at
the bottom. Tools keep their touch targets and scroll horizontally on narrow
phones; the canvas does not lose a second row. Contextual commands can also
scroll horizontally, and detailed options use the same bounded popovers.

The shell responds to the editor's measured width, not a containing page's
assumed device size. The existing 900px desktop/mobile boundary remains.

## Visual system

- Inherit the application font and existing Inkio theme tokens.
- Foreground: `--inkio-text-heading`; secondary labels: `--inkio-text`.
- Surfaces: `--inkio-bg`, `--inkio-bg-subtle`, and `--inkio-bg-muted`.
- Focus/interaction: existing primary and ring tokens.
- Destructive actions: existing danger text/background tokens.
- Use one raster over the themed workbench. A theme-independent gray checker
  shows alpha only inside the image preview or crop aperture; it never enters
  export. Real pixels outside the aperture are dimmed without adding opacity.
- Crop dragging commits only positions that keep the frame covered. At an
  edge, a small preview-only offset springs back on release. Reduced motion
  clamps without this effect.
- Spacing uses 4, 8, 12, 16, and 24px steps.
- Selected tools use a filled surface without an underline. Keep the
  focus-visible ring independent from selection.
- Save uses foreground/background contrast. Only Save has the strongest fill.
- Labels and controls use a compact 12-14px scale, with 11px tool captions.
  These are tool labels, not paragraph text; the reference-led density is
  intentional. Inputs and labels remain legible and contrast is checked.
- Desktop controls are at least 32px high; mobile interactive controls are at
  least 44px. Icon size is independent of the hit area.
- Hover, pressed, focus-visible, disabled, saving, and error states preserve
  their control's dimensions. Reduced motion removes decorative transitions.

## Verification

Capture every tool at 1440x1080, 1000x800, and 390x844 in both themes. Also
exercise a short phone, a 320px phone, and a landscape phone. Check default and
selected-annotation options, text entry, all layer actions, color pickers,
touch/pointer drawing, crop/resize, zoom/fit, and failed-save retry.

Browser assertions protect these outcomes:

- The desktop rail is left of the photograph and narrow.
- Contextual commands sit above the photograph without a bottom options sheet.
- The image retains useful width and height on a small laptop.
- Phone options and the tool reel remain inside the viewport.
- Every control remains reachable with pointer, touch, and keyboard.
- The mobile percentage control fits the image after zooming.

Before captures and measurements:
`/tmp/inkio-compact-1794678701473/before/manifest.json`.
Screenshots are local verification artifacts, not package assets.

## Live gestures

Text input, text wrapping, selection actions, and redaction sampling must follow
the current canvas geometry before pointer release. Persist one undo step at the
end of a gesture. Browser coverage must assert intermediate frames with the
pointer still held, not only the final document.

Before captures: `/tmp/inkio-live-glass-1794731834086/before-photo-*`.

Earlier live-gesture verification (before the crop display change):

- All 74 production browser cases pass across Chromium and Firefox, including
  assertions before pointer release for text bounds, selection actions, and
  redaction movement/resizing.
- Native Chromium touch events resize the focused input by the requested
  24 x 18 CSS pixels while the finger remains down.
- All eight tools have fresh real-photo captures at 1440px desktop and 390px
  mobile in both themes: 32 captures, with no editor overflow.
- The actual photo exports to a 560 x 320 PNG after touch editing. An untouched
  corner remains pixel-identical to the source; the decorative backdrop is
  excluded from export.
- Image-editor typechecking, 201 unit tests, declaration and dual-format builds,
  the production Next example build, publint, and attw pass.
- Raw dual-format JavaScript is 251609/252000 bytes. This correction adds no
  dependency and does not raise the existing budget.
- The existing unrelated core CJS build warning remains. Safari, physical
  mobile keyboards, and physical touch hardware were not exercised.

Evidence: `/tmp/inkio-live-glass-1794731834086/visual-matrix.json`,
`native-touch.json`, `photo-export.json`, and `final-*` captures.

Verified for the compact-shell baseline, before the direct-editing follow-up:

- 48 tool/size/theme captures, plus all tools at 320x568 and 812x375.
  The editor stays within the viewport at every checked size.
- At 1000x800, the resize workspace changes from 952x290 to 876x668;
  the filter workspace changes from 952x230 to 876x623.
- Real photographs, Korean labels and multiline text, touch drawing, all four
  layer actions, bounded color selection, and PNG export were exercised.
- All 19 image-editor browser scenarios pass in Chromium and Firefox.
  Two additional phone-width regressions also pass in both engines, checking
  44px annotation Delete and discard/cancel targets, focus, and actual actions.
- The workspace's 886 unit tests pass; an additional accessibility regression
  was then added and all 190 image-editor tests pass, for 887 unique tests.
- Workspace typechecks, declaration generation, example builds, publint,
  and attw pass. Image-editor JavaScript is 243270/244000 bytes; the existing
  budget was preserved by sharing command-bar and popover implementations.
- Existing build warnings remain in the Vite configuration's `__dirname`
  usage and a core CJS dynamic request imported by the unrelated editor demo.

## Gap ledger

| ID | Existing gap | Correction | Proof |
| --- | --- | --- | --- |
| G1 | A 320px inspector remains mostly empty | Replace it with inline commands and on-demand popovers | Wide desktop captures and geometry |
| G2 | Small laptop options reserve 250-520px below the image | Remove the bottom sheet and use shallow controls above the photo | Laptop captures, useful stage-height assertion |
| G3 | Phone option content is vertically clipped | Open detailed options in bounded popovers | All tool/selection controls reached on phones |
| G4 | Repeated pill backgrounds dominate the image | Quiet, aligned navigation and compact controls | Paired light/dark before/after captures |
| G5 | Phone Fit is hidden while its percentage is not interactive | Make the visible percentage the Fit action | Real zoom then pointer/touch Fit assertion |
| G6 | Mobile tool state is only visually indicated | Expose selected state and visible captions | Accessible pressed state and touch checks |

## Direct editing follow-up

The follow-up keeps the compact shell and removes the selected tool's edge
stripe. The preview application uses the platform system font instead of its
previous Avenir Next stack; the editor library continues to inherit its host.

Layout: text editing is a transparent native input over the actual canvas text,
using that text node's image projection, without another properties textbox or
new reserved space. New text receives focus immediately; existing text can be
edited in place. Formatting stays in the contextual row. Native selection,
multiline input, Korean composition, outside-click completion, and Escape
remain available.

Valid dimension input updates the image immediately, as requested in the
follow-up clarification. Applied dimensions are positive integer pixels.
Crop-only changes retain Apply; entering dimensions also commits the current
crop draft. Image rendering, annotation
creation/dragging, selection overlays, and export must share the same
projection after resize, crop, rotation, and preview zoom.

Escape or Ctrl/Cmd+Enter completes text editing and returns focus to the
canvas. Enter on the focused canvas reopens selected text; double-click and
double-tap also reopen it. Enter within the input creates a new line, and
composition keystrokes do not complete editing. Creation and typing share
one undo gesture; completing an empty entry restores the clean prior scene.
The native input keeps a 16px font floor while its transform preserves the
canvas glyph size.

Reset seeds the crop in original-image coordinates while retaining rotated
display dimensions. Locked dimension input holds its ratio through the edit
gesture. Deferred popover autofocus preserves a field the user already chose.

The workbench owns shortcuts only while it has focus. Portaled options
follow their trigger in sequential Tab order; Escape returns focus to that
trigger. The keyboard canvas supports annotation placement, selection,
movement, deletion, direct text entry and crop adjustment. While the crop
frame is active, annotations stay visible for context but do not receive
pointer input. Applying an unchanged draft preserves the original visual
references and does not consume an undo step.

Decoded source images are limited to 8,192px per side and 32 million pixels;
the LRU retains at most 12 million decoded pixels. Export is limited to
4,096px per side and 16 million pixels. Preview surfaces account for device
pixel ratio; this limit does not change export size. Export rasterizes a
detached scene at 1× to avoid duplicate Stage and hit canvases, encodes with
`toBlob()`, and converts the resulting Blob to the public data URL format
after releasing the raster. A mismatched browser encoder MIME type is an
error, not a silently substituted format.

The direct-editing features deliberately raise the raw dual-format JavaScript
budget from 244000 to 252000 bytes. This covers native canvas text editing,
live integer dimension input, and the shared per-axis preview/export mapping;
it does not add a runtime dependency.

Verified follow-up evidence before the text selection-box correction below:

- The final single browser run passes 56 cases across Chromium and Firefox.
  Pixel assertions cover creation, dragging, and PNG export after unequal-axis
  resizing, zoom in both operation orders, and rotated cropping. Additional
  rows cover rotated Reset and locked sequential width/height typing, retained
  input focus, and actual PNG dimensions.
- The earlier workspace run passes 892 unit tests and all typechecks. The
  latest image-editor suite passes 201 tests, for 898 unique cases across
  these runs.
- Final package/declaration and Next builds pass; measured JavaScript is
  251956/252000 bytes. Public-package gates and other example builds pass.
- Sixteen final real-photo captures cover 1440, 1000, 390, and 320px in both
  themes, including direct Korean text entry. All eight saves produce the
  expected 560x320 PNG, focus returns to the canvas, and no root overflows.
- A 2000x1500 image keeps the native input at 16px and viewport scale at 1.
  No browser errors or warnings appeared during the final manual run.
- The final review corrections were also exercised on real photos at desktop
  and phone widths: every digit retained input focus and the locked ratio,
  and Reset after rotation saved the complete frame. Saved rotated PNG bytes
  and source hashes are retained beside the raw logs.

Follow-up captures and raw logs:
`/tmp/inkio-followup-1794693430854/qa.json`.

## Text selection-box follow-up

Layout: retain the existing canvas selection border and resize handles around
the transparent native text input, without adding a properties panel or a
second resizer. Handles remain visible during typing. A transform gesture
preserves native input focus, and its geometry stays in the text preview
transaction until completion. An empty resized entry can still be cancelled
without leaving an edit or an undoable placeholder.

The text hit rectangle uses the same explicit scaled height as the painted
text and native input. The old redundant measured-height cache prevented
height-only shrinking. Native input layout also refreshes the existing Group
transformer when the annotation changes.

Verification: all 201 image-editor unit tests and 66 Chromium/Firefox browser
cases pass, including actual selection-layer pixels, enlargement, height-only
shrinking, continued input, and empty cancellation after resizing. Package
types/declarations, Next build, and the unchanged bundle budget pass:
251809/252000 bytes. Matched before/after real-photo captures cover desktop
and phone widths in both themes; all four resized photos save at 560x320.
Native Chromium touch events also retain input focus while resizing.

Evidence: `/tmp/inkio-text-resize-1794703443271/`.
