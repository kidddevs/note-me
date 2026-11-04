# Books Studio audit & roadmap

_Last reviewed: November 2026_

Books Studio already has an unusually strong foundation for a local-first writing app: a real manuscript data model, a direct-manipulation page canvas, print-aware typography, multi-format export, version checkpoints, and a considered editorial UI. The work below focuses on the gap between "beautiful manuscript editor" and "industry-grade magazine production surface."

## What is already strong

- **Content model**: books and sections are first-class SQLite records, not serialized notes. Section kinds carry semantic meaning and reorder within front/story/back bands.
- **Page canvas**: flow and free layout, eight-handle resizing, multi-select alignment, layers, margin guides, rulers, zoom, full bleed, free margins, and a contextual design inspector.
- **Typography**: role styles, named paragraph styles, character and paragraph controls, hyphenation, columns, drop caps, nested openings, rules, borders, shading, bullets, tab stops, and GREP styling.
- **Content blocks**: artwork, tables, charts, callouts, captions, runaround, and full-bleed metadata stored in portable Markdown comments.
- **Publishing**: generated contents, page-number ranges and per-section overrides, running headers/footers, EPUB 3, DOCX, styled HTML, Markdown, plain text, and native print/PDF.
- **Editorial workflow**: autosave, undo/redo, version checkpoints, find/replace, writing sprints, focus mode, outline, and export preflight.

## Gaps that matter for magazines

### P0 — magazine production fundamentals

1. **True spreads and pagination.** Magazine teams review facing pages, not isolated sections. Books Studio needs a spread proof, gutter treatment, and a predictable page-break model.

### P1 — production polish

2. **Image craft.** Crop/reposition inside frames, focal-point control, image fit presets, caption placement, and bleed-aware export.
3. **Print packaging.** Bleed settings, crop/registration marks, PDF preflight, embedded-font checks, and page-count parity between the canvas and print output.
4. **Free-layout export fidelity.** Widths and alignment now travel, but free X/Y placement and full-bleed pages still flatten in some exported formats.
5. **More page masters.** Photo essay, recipe, advertisement, and opening-spread masters on top of the current feature, department, contents, cover, full-bleed, and colophon set.

### P2 — newsroom and studio workflow

6. **Issue planning.** Story status, assignee, due date, word budget, and a flat-plan view across pages.
7. **Editorial review.** Comments, tracked changes, and compare-two-checkpoints views.
8. **Asset library.** Shared photo library with usage tracking, alt text, credits, and licensing notes.

## Landed in this pass

- **Magazine section vocabulary**: cover, masthead, contents page, editor's letter, feature, department, column, profile, interview, review, photo essay, recipe, listing, advertisement, and colophon.
- **Starter templates**: novel, nonfiction, magazine issue, newsletter, photo book, and recipe book, each seeding a real section sequence and page system.
- **Editorial paper systems**: magazine, newsletter, lookbook, zine, annual report, and recipe book presets; new digest, newsstand, catalogue, and portfolio trim sizes.
- **Editorial style kit**: kickers, standfirsts, bylines, section labels, cover lines, folios, contributor bios, and contents entries, with one-click insertion from the canvas toolbar.
- **Typographic depth**: ligatures, oldstyle/lining/tabular figures, hanging punctuation, last-line alignment, widows/orphans, keep-lines, page breaks, and a non-printing baseline grid with leading snap.
- **Export fidelity**: applied paragraph styles now emit scoped CSS for HTML, EPUB, and print, including drop caps, rules, shading, widths, and alignment. Text blocks keep their designed width and placement in exported markup.
- **Issue metadata**: volume, issue, season, and year with `{{volume}}`, `{{issue}}`, `{{season}}`, `{{year}}`, and `{{issueLine}}` running-head tokens.
- **Section page masters**: per-section paper, accent, margins, baseline grid, free margins, six magazine masters, suggested masters by section kind, apply-to-book and apply-to-kind actions, rail badges, and per-section page rules in HTML/EPUB/print.
- **Section running furniture**: each section can carry its own three-slot running header and footer, page-number visibility, placement, style, start number, and custom format. Furniture resolves in the canvas, export preview, HTML, EPUB, and print, with a one-click return to the book chrome.
- **Cover studio**: a full-wrap Photoshop-style designer with front/spine/back artboards, layered text/image/shape/line/ornament/barcode objects, an image lab with graded presets, tone and hue controls, duotone tint, focal-point crop, shape masks, and flips, gradients, blend modes, opacity, lock/visibility, collapsible layer groups with inherited visibility/locking and drag-to-group, multi-selection with align/distribute, draggable rulers and persistent custom guides, smart layer snapping, zoom, preview, undo/redo, six complete wrap templates, page-count-driven spine math with paper stock, movable ISBN/EAN-13 barcode or custom barcode image, 150/300 DPI full-wrap and individual panel downloads, print-ready PDF with crop marks, fold marks, colour bar and slug, a draggable 3D book mockup, full-wrap print, and an optional cover page in HTML and EPUB exports.

## Recommended next slices

1. **Spread proof + flat plan** — facing-page view, gutter preview, and an issue outline with word budgets.
2. **Print packaging** — bleed/crop marks, PDF preflight, and parity warnings between canvas and print.
3. **Image craft** — focal-point crop, caption placement, credits, and reusable asset library.
4. **More page masters** — photo essay, recipe, advertisement, and opening-spread systems.
