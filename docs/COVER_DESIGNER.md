# Cover designer: implementation and QA

The cover editor lives in Books Studio. A book's `layout_json` contains
`cover.doc`; the normal book update API persists it in SQLite. Keep all editor,
template, print, and digital-export paths on this shared document.

## Source map

| File | Responsibility |
| --- | --- |
| `src/components/BooksCoverStudio.tsx` | Editor, selection, groups, inspector, autosave, undo/redo, canvas interactions |
| `src/components/CoverImageFocus.tsx` | Shared pointer/keyboard crop-focus preview |
| `src/components/CoverColorPicker.tsx` | Shared wheel, HSV/RGB/alpha/hex fields, palette and eyedropper integration |
| `src/lib/bookCoverColor.ts` | Hex validation and normalization, RGB/HSV conversion |
| `src/lib/bookCoverImages.ts` | Selected-layer raster exports, background lifting, image reset and frame-ratio helpers |
| `src/lib/bookCoverLayers.ts` | Selection ordering and group assignment without mutating the document |
| `src/lib/bookCoverDoc.ts` | Document normalization, full-wrap geometry, HTML markup, raster rendering |
| `src/lib/bookCoverLibrary.ts` | Saved templates, cross-trim adaptation, `.bookcover` interchange |
| `src/lib/bookCoverPreview.ts` | Isolated IndexedDB persistence for the development fixture |
| `src/lib/bookCoverHistory.ts` | Per-book IndexedDB history persistence |
| `src/lib/bookImageLibrary.ts` | Local reusable image library |
| `src/lib/bookCoverPreflight.ts` | Print checks, including background image resolution |
| `src/lib/bookCoverPdf.ts`, `bookCoverPackage.ts`, `bookCoverMockup.ts` | PDF, production package, and marketing output |

## Layer ordering and groups

`doc.layers` is stored from back to front. The Layers panel displays the reverse.
`moveCoverLayers(doc, ids, destination)` and `stepCoverLayers(doc, ids, direction)`
return a new document, or `null` for an invalid, locked, or unchanged move. Input
documents and layer objects stay unchanged.

- `placement: "before"` means above the target in the visible list, and therefore
  after it in the stored stack. `"after"` means below it.
- Multi-selection moves as one block, preserving its original stacking order.
  A layer drop adopts the destination layer's group. A group-header drop joins
  that group and expands it. Dropping onto Background leaves the group and moves
  the selection to the bottom of the ordinary layer stack.
- Any locked member prevents moving the selection. Locked groups, including
  groups containing individually locked children, reject incoming layer drops.
- Background is a pinned document setting, outside the ordinary layer array.
- Pointer dragging supports row and grip dragging, insertion lines, list-edge
  scrolling, and cancellation by Escape, pointer cancellation, or window blur.
  Keep one pointer gesture separate from click-to-select and inline rename.
- Shift/Cmd/Ctrl-click toggles selection. Enter/Space selects a focused row;
  Alt+Up/Down reorders it. The compact drawer stays open while selecting layers.
- Group creation gathers selected members into one ordered block. Clicking an
  unlocked group header selects all its members for canvas movement. A group
  with locked members stays available for group controls without partial movement.
  Group arrows move the whole block; ungrouping preserves the children.
- Duplicate/delete controls act on the complete selection. Keep the context
  menu, panel footer, selection toolbar, and keyboard commands consistent.

The panel header must fit both its 228px and 208px desktop widths. Add-image and
new-group controls live beside search so the collapse icon stays inside the rail.
Check the History tab too, since its undo/redo controls share that header.

## Color tools

The shared picker provides a hue/saturation wheel, saturation/brightness square,
HSV and sRGB numeric fields, alpha, hex input, recent colors, and document colors.
Every solid fill, gradient stop, pattern color, image tint, and layer effect uses
the same picker. Reuse it for new cover color controls.

`normalizeCoverHex` accepts optional `#` and 3, 4, 6, or 8 hex digits, expands
shorthand, and returns lowercase `#RRGGBB` or `#RRGGBBAA`; invalid input returns
`null`. `parseCoverColor`, `rgbaToHex`, `rgbToHsv`, and `hsvToRgb` provide the shared
conversion contract. Hex text stays a local draft until committed, so incomplete
input cannot corrupt a saved fill. Document and brand palettes preserve alpha.

`CoverColorProvider` connects the picker to the active document palette and the
canvas eyedropper. **Save colour** adds the current color to the document.
**Sample cover** closes the picker and samples once into that exact field or
gradient stop. Escape cancels sampling. The regular **E** tool still samples into
the selected layer or background and collects document colors.

Keyboard events inside the picker must stay inside it: arrows adjust color,
Escape closes it, and focus returns to the originating swatch. The popover follows
scroll and resize and remains inside the viewport. Do not use native color inputs
for gradient stops or let the gradient remove-button CSS override swatch sizing.

## Image backgrounds and exports

`doc.backgroundImage` is optional on version-1 documents. Missing values normalize
to `null`; explicit `null` removes an existing image even when a fallback document
has one. Older covers remain valid without a migration.

An image background stores `src`, `sourceWidth`, `sourceHeight`, `fit`, `focusX`,
`focusY`, `opacity`, `blur`, `tint`, and `tintStrength`. Dimensions default to zero
for legacy sources. Focus and opacity use 0–1; blur uses inches, clamped to 0–0.08.
The existing solid/gradient/pattern fill remains beneath the image, including in
transparent areas or contain-fit margins.

Uploads are embedded data URIs and also enter the existing local image library.
The background inspector can reuse library images and extract a document palette.
Stock background choices are decoded and embedded with their pixel dimensions,
so they do not depend on app-relative URLs when shared or exported.

The background occupies the entire wrap, including bleed. Front, back, and spine
views crop that same image; they must never refit the photo separately per panel.
`coverBackgroundImageMarkup` is shared by the live stage and HTML rendering.
`renderCoverCanvas` uses matching crop/focus rules and composites image/tint before
applying background opacity. Zero opacity must not leak a tint into the paper.
CSS blur converts inches to 96px/in; raster blur converts inches to export DPI.

`hasCoverDocument`, initial editor seeding, and `.bookcover` parsing accept a
background-only design. Preserve the background through layout serialization,
templates, history, print proofs, panel images, PDFs, and production packages.

Preflight measures background DPI against the full wrap. Cover-fit uses the
smaller source-pixels/placed-inches ratio; contain-fit uses the larger ratio.
Unknown legacy dimensions produce an informational check. A small background
needs a larger source image; shrinking the wrap is not an automatic resolution fix.

## Image tool integrations

The image lab and background inspector share `CoverImageFocus`: drag or click the
preview, use arrow keys (Shift for larger steps), press Home, or click Center.
Both controls update the same focal values consumed by the canvas and exporters.
The preview keeps the frame's aspect ratio, including narrow spine artwork.

**Match photo ratio** adjusts frame height around its center using the recorded
source dimensions. Legacy sources without dimensions disable that action.
**Reset tone** preserves crop, flips, shape mask, and painted erasure. **Reset crop**
preserves tone and erasure. Clearing the erase mask remains a separate explicit action.

**Copy to wrap background** renders the selected photo with its edits, embeds the
result, and keeps the original editable layer hidden in Layers. It is one undoable
change. The derived image uses WebP when the canvas encoder supports it and PNG
otherwise. Oversized results are rejected before altering the document. Async
rendering checks the book and source layer again before committing, so edits made
while rendering cannot be silently overwritten.

**Edit as image layer** uses `liftCoverBackground` to place an equivalent image
frame at the bottom of the wrap stack and clear the pinned background image.
It preserves fit, focal point, opacity, blur, tint, and source dimensions. The
Eraser inspector offers **Erase on background image** to perform that conversion
and activate the mask eraser immediately. The conversion is undoable.

The Download menu's **Selected layers PNG** exports visible selected layers with
transparency, cropping to their rotated bounds and allowing room for effects.
`renderCoverSelectionCanvas` delegates to `renderCoverCanvas` with `region`
(full-wrap inches), `layerIds`, and `transparent: true`. Clipping bases remain in
the document even if they are not selected for drawing. Selection PNGs contain
the chosen artwork without a proof watermark. Empty selections and allocations
over 32 million pixels fail explicitly. The regular cover exports retain their
paper, background, bleed, and proof options.

## History and autosave

All document changes use `updateDoc`/`updateCover` and the existing debounced book
save. Keep refs current and preserve error reporting from the real update API.
Undo/redo must capture the current cover **before** scheduling React state
updaters: reading `layoutRef.current` inside a deferred updater can capture the
restored state and break redo. Reset the edit-coalescing key after restoring a
snapshot so a fresh edit clears redo correctly. Switching books clears the active
group, tool, selection, and pending picker sample target.

## Browser development preview

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:1420/cover-preview.html` for the real editor with a development
fixture. It defaults to dark appearance; add `?theme=light` for light appearance.
The page is excluded from the production Vite entry and its script rejects
production execution. It does not open the native database.

The fixture uses book `-701`, chapter `-702`, and the separate IndexedDB database
`noteme-cover-preview` (`books` store). Its persistence adapter maps the
camelCase `BookInput` contract back to snake_case `Book` fields, so reload tests
exercise saved documents instead of retaining an unchanged initial layout.
The fixture saves after the IndexedDB transaction commits and supports photo-heavy
documents beyond session-storage quotas. `loadCoverPreviewBook`,
`saveCoverPreviewBook`, and `clearCoverPreviewBook` in the preview storage module
provide inspection and reset for this negative-id fixture only. Import that helper
for QA; importing the page bootstrap again would mount another React root.
History and image-library utilities also use browser IndexedDB. Use a disposable
browser profile for QA; do not clear another user's library or storage.

The fixture intentionally supplies only cover interactions. It does not prove
native navigation, SQLite persistence, or native save dialogs. Test those through
the Tauri app when changing their contracts.

## Validation checklist

```bash
npm test
npm run build
git diff --check
```

There is no lint script. The test command runs TypeScript checks, Node tests, and
Rust validation/migration tests. Focused regressions cover color conversion and
alpha, reversed drag placement, ordered multi-selection moves, group locks,
background normalization/removal, template/layout round trips, panel markup, and
background DPI. Existing publishing tests cover the downstream export utilities.

For interactive changes, check:

1. Drag above and below a layer, drag several selected layers, cancel a drag,
   enter/leave groups, and try a locked selection.
2. Group/ungroup, select a group, move it on the canvas, duplicate/delete multiple
   layers, undo, redo, and edit after undo.
3. Type hex, RGB, HSV, and alpha; use the wheel/square with pointer and keyboard;
   reuse saved/document colors; sample into a specific gradient stop.
4. Upload and reuse a background, edit fit/focus/opacity/tint/blur, extract its
   palette, remove it, undo removal, and reload after autosave. Copy an edited
   photo into the background, lift it back into a layer, and erase on a background.
5. Compare wrap and panel raster pixels for the same background. Check contain
   alignment and zero-opacity tint. Export a clipped selection as transparent PNG,
   including when its clipping base is unselected. Compare background/lifted-layer
   pixels with opacity and tint. Inspect print preflight and template round trips.
6. Check dark/light appearance, header containment at 1440px and 1280px, the
   compact drawer at 1024px and 390px, and picker containment on short viewports.

The November 7, 2026 pass ran 152 Node tests and 5 Rust tests successfully, built
the production UI, and exercised the browser interactions and raster comparisons
above. Vite reported mixed static/dynamic `fflate` imports and a studio chunk over
500 kB; those are build warnings, not failed checks. Browser fixture validation
does not substitute for a native Tauri smoke test.
