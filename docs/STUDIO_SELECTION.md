# Studio selection and arrangement

Page objects and cover layers share arrangement geometry and controls. Keep their
units at the caller boundary: cover rectangles use full-wrap inches; page objects
use percentages of the page content width, including for vertical measurements.

## Cover workflow

- Shift/Cmd/Ctrl-click Layers rows or canvas objects to build a selection. A group
  header selects its members. Multiple selected layers show a shared dashed frame
  and a **Transform selection** inspector instead of editing only the primary one.
- Drag a shared corner to resize proportionally around the opposite corner.
  The inspector's width/height fields resize around the shared center; commit
  numeric edits with Enter or by leaving the field. X/Y move the shared visual
  bounds in full-wrap inches. Panel ownership remains unchanged.
- Drag the shared rotation handle to rotate every member around the same center.
  Shift snaps the gesture to 15-degree increments. Inspector buttons rotate the
  selection by 15 degrees left/right or 90 degrees right.
- Scaling also changes text point sizes, shape strokes, image/shape radii, image
  blur and enabled shadow/glow/highlight distances. Relative crop focus, source
  pixels, erase masks, metadata, stacking and group membership stay with each item.
- Any selected layer or inherited group lock blocks the whole transform, move,
  nudge or arrange action. Never silently transform only unlocked members.
- A pointer gesture creates one undo entry. Escape, pointer cancellation or window
  blur restores its starting cover and history/redo state. Right-clicking does not
  start a transform or paint an erase stroke.
- Smart snapping uses rotated visual bounds for the selection and other layers.
  Snap guides are stored/rendered in full-wrap coordinates, including while a
  front, back or spine view is active. Alt temporarily bypasses movement snapping.

**Align to Selection** aligns the individual selected members to their shared
edges/centers. **Current artboard** aligns them to the active front, back, spine or
full-wrap view; **Artboard safe area** adds a quarter-inch inset (plus bleed in a
wrap view), reduced for very narrow spines. These actions align the members; use
the shared X/Y fields or drag a member to move their composition together.

**Space by Equal gaps** distributes the distance between visual edges;
**Equal centers** distributes their center points. Both need at least three items,
keep the two outer items fixed, preserve stacking order, and allow an existing
overlapping span instead of automatically enlarging it.

## Manuscript workflow

Multi-select page objects to open **Align & arrange**. The same spacing choices
work horizontally or vertically. Alignment targets either the selection or the
page content area. Arrange controls require Free layout; the inspector can enable
it while retaining the selected objects. Flow/Free changes retain the selection
while applying the mode's own placement rules.

Each arrange action establishes an undo boundary, separate from the typing timer.
History stores selected block indices with each content snapshot, then resolves
them back to Markdown ranges on restore. Longer/shorter presentation attributes
must not make selection point at another object after undo/redo or a layout change.

These operations save portable Markdown through the existing chapter store.
Free-layout X/Y positioning in exported interiors remains a separate fidelity
gap; these controls do not establish HTML/EPUB/Word pagination parity.

## Implementation contracts

| File | Responsibility |
| --- | --- |
| `src/lib/studioGeometry.ts` | Unit-independent bounds, rotation, alignment and spacing |
| `src/components/StudioArrangeControls.tsx` | Shared references, align actions and spacing controls |
| `src/lib/bookCoverGeometry.ts` | Panel/spread conversion and atomic cover transforms |
| `src/components/CoverSelectionInspector.tsx` | Shared cover geometry fields and arrangement inspector |
| `src/components/BooksCoverStudio.tsx` | Pointer gestures, selection box, snapshots, snapping and persistence |
| `src/components/BooksStudioEditor.tsx` | Measuring page objects, Markdown patches and selection history |
| `src/components/BooksStudioInspector.tsx` | Page arrangement and Free-layout handoff |

- `studioBounds(rects)` returns their union, or `null` for empty/non-finite/negative
  geometry. `rotatedStudioBounds(rect, degrees)` returns an axis-aligned visual
  box around the original center.
- `alignStudioRects(rects, mode, target?)` and
  `distributeStudioRects(rects, axis, spacing?)` return new objects in input order.
  They preserve dimensions, caller metadata and the unaffected axis. Invalid
  geometry or fewer than three distribution items returns an empty result.
- `coverSelectionBounds`, `alignCoverLayers` and `distributeCoverLayers` use rotated
  visual rectangles and convert results back to each layer's local panel inches.
  Distribution's optional fourth argument is `gaps` (default) or `centers`.
- `transformCoverSelection(metrics, doc, ids, change)` returns `{id, patch}` values
  for one atomic similarity transform. `dx`/`dy` translate, `scale` uniformly scales
  and `rotation` adds degrees. `anchor` is an optional spread-inch pivot; otherwise
  the selection center is used. The input document is immutable.
- Missing/locked members, non-finite parameters, non-positive scales, or any result
  that would be clamped by the cover normalizer reject the whole operation with
  `[]`. Disabled effect defaults are not scaled and cannot limit a valid resize.
- Keep cover geometry in the existing version-1 document. All updates use the
  existing history, autosave and renderer paths; there is no database migration
  or new production dependency in this slice.
- `coverLayerMinimumHeight(type)` supplies the shared normalization, resize and
  transform floor: 0.001 inch for rules and 0.02 inch for other layer types. This
  lets typography groups shrink without a hairline rule blocking the operation.

## Verification

Use the negative-id fixture at `/cover-preview.html`, including its Manuscript
navigation, and disposable browser data. Run `npm test`, `npm run build`, and
`git diff --check`. Exercise different object sizes, rotated layers, cross-panel
selections, locked groups, committed/cancelled pointer gestures, individual undo
steps, metadata reload, spacing and mode handoff. Check exported cover artwork
through the real Download action. Native navigation and SQLite/UI behavior still
need a Tauri smoke test; fixture browser checks do not establish those results.

On November 8, 2026, the regression suite passed 179 Node tests and 5 Rust tests.
Browser checks exercised proportional numeric and corner resizing, shared-pivot
rotation (including Shift snapping), one-step undo/redo, Escape/pointer-cancel
rollback, locked-member nudging, group selection, full-wrap snap-guide placement,
and toolbar/inspector spacing agreement. Page checks used unequal image widths,
verified distinct gap/center results, individual undo steps, retained selections,
Flow/Free handoff and reload. A real Download action produced a transparent
1011 × 1011 PNG matching the rotated selection's export bounds at 150 DPI.
Complete template groups, including thin rules, resized and reloaded correctly;
the inspector fit 1024- and 1280-pixel windows in dark and light appearance.
