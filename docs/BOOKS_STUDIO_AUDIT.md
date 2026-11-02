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

1. **Per-section running furniture.** Page masters now cover paper, accent, margins, and baseline settings; per-section headers/footers and page-number overrides should follow.
2. **True spreads and pagination.** Magazine teams review facing pages, not isolated sections. Books Studio needs a spread proof, gutter treatment, and a predictable page-break model.
3. **Cover studio.** Covers need structured cover lines, issue line, masthead lockup, sell lines, barcode block, and an exportable cover page. The current cover preview is useful, but not a full cover design surface.

### P1 — production polish

4. **Image craft.** Crop/reposition inside frames, focal-point control, image fit presets, caption placement, and bleed-aware export.
5. **Print packaging.** Bleed settings, crop/registration marks, PDF preflight, embedded-font checks, and page-count parity between the canvas and print output.
6. **Free-layout export fidelity.** Widths and alignment now travel, but free X/Y placement and full-bleed pages still flatten in some exported formats.
7. **Master page presets.** One-click feature opener, department, contents, photo essay, recipe, and advertisement page templates that apply real page geometry.

### P2 — newsroom and studio workflow

8. **Issue planning.** Story status, assignee, due date, word budget, and a flat-plan view across pages.
9. **Editorial review.** Comments, tracked changes, and compare-two-checkpoints views.
10. **Asset library.** Shared photo library with usage tracking, alt text, credits, and licensing notes.

## Landed in this pass

- **Magazine section vocabulary**: cover, masthead, contents page, editor's letter, feature, department, column, profile, interview, review, photo essay, recipe, listing, advertisement, and colophon.
- **Starter templates**: novel, nonfiction, magazine issue, newsletter, photo book, and recipe book, each seeding a real section sequence and page system.
- **Editorial paper systems**: magazine, newsletter, lookbook, zine, annual report, and recipe book presets; new digest, newsstand, catalogue, and portfolio trim sizes.
- **Editorial style kit**: kickers, standfirsts, bylines, section labels, cover lines, folios, contributor bios, and contents entries, with one-click insertion from the canvas toolbar.
- **Typographic depth**: ligatures, oldstyle/lining/tabular figures, hanging punctuation, last-line alignment, widows/orphans, keep-lines, page breaks, and a non-printing baseline grid with leading snap.
- **Export fidelity**: applied paragraph styles now emit scoped CSS for HTML, EPUB, and print, including drop caps, rules, shading, widths, and alignment. Text blocks keep their designed width and placement in exported markup.
- **Issue metadata**: volume, issue, season, and year with `{{volume}}`, `{{issue}}`, `{{season}}`, `{{year}}`, and `{{issueLine}}` running-head tokens.
- **Section page masters**: per-section paper, accent, margins, baseline grid, free margins, six magazine masters, suggested masters by section kind, apply-to-book and apply-to-kind actions, rail badges, and per-section page rules in HTML/EPUB/print.

## Recommended next slices

1. **Per-section running furniture** — let page masters set their own header/footer slots and page-number style.
2. **Cover studio** — structured cover lines, masthead lockup, issue line, barcode block, and cover export.
3. **Spread proof + flat plan** — facing-page view, gutter preview, and an issue outline with word budgets.
4. **Print packaging** — bleed/crop marks, PDF preflight, and parity warnings between canvas and print.
5. **Image craft** — focal-point crop, caption placement, credits, and reusable asset library.
