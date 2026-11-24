# Studio publishing

## Library cards

`filterLibraryBooks` in `src/lib/bookLibrary.ts` matches each search term against
saved book metadata. `libraryStatusCounts` counts the entire shelf, so the stage
counts stay stable as a search narrows. The shelf sorts a copy and leaves the
store order intact. Card actions use the book tab and its existing section memory.

`LibraryCover` uses the same `CoverArtwork` renderer as the export preview.
A saved layered cover displays the full back, spine, and front at the spread's
aspect ratio. The publication cover toggle only controls the default export
choice. A book with a legacy cover template shows the front, and a book without
cover artwork shows its colour and genre. `libraryCoverColors` resolves an
opaque background from the saved cover color and picks black or white for the
genre and book icon based on sRGB contrast. Layered artwork keeps its own ink.

In Book settings, **Page design** spans the full settings grid. Paper presets
wrap to the number of columns that fit.

## Edition and save

`bookForExport` resolves cover and contents from manuscript defaults plus
the current choices. Export Studio keeps those choices in the mounted screen
for one manuscript. Use **Use manuscript defaults** to reset them. Preview,
preflight, and the file builders read the same resolved edition.

`bookPackageSummary` reports section readiness, generated contents, and how the
format handles placed manuscript artwork. It counts artwork blocks and whether
credits are present. It also shows an estimated interior page count derived from
trim, margins, body leading, columns, and section overrides. That number is a
planning estimate, not a replacement for the browser or system print proof.

`bookExportChecks` links missing metadata, empty sections and contents gaps to
settings, writing, or Outline. Portable formats warn when the manuscript uses
an installed/custom family. The default keeps only the family name, so the
recipient must have the font installed or accept the target application's
fallback. Native Export Studio can load matching TTF/OTF family faces for EPUB,
standalone HTML, and Word. It matches the requested weight and normal/italic
style for every selected family, including variable faces whose `wght`, `ital`,
or `slnt` ranges cover the request; the shared picker exposes those ranges and
lets authors preview weight and italic treatment before choosing a family.
Export Studio lists each requested variant with its exact face or missing match. Embedding is opt-in and requires the
explicit confirmation **I have permission to redistribute these font files with
this export**. NoteMe cannot determine a license automatically; TTC collections
remain local-only and are not treated as embeddable. The same preflight flags
styles that combine page breaks with a keep-together rule so they can be
checked in Print / PDF. An empty manuscript still blocks export; other
findings guide review.

| Format | Output |
| --- | --- |
| EPUB 3 | Reflowable chapters, optional front cover, reader navigation, and optional licensed TTF/OTF font faces. If generated contents are omitted or empty, navigation opens the title page via **Start reading**. |
| Styled HTML | One styled document with optional front cover and linked contents. The file builder embeds bundled cover photos and optional licensed font faces as data URIs. |
| DOCX | Editable text and styles, compatible embedded images, captions and credits, and optional licensed regular/bold/italic font faces through grouped OOXML font parts. Other image sources become text descriptions. |
| Markdown | Source with book metadata, image references, and portable layout attributes. |
| Plain text | Section text and artwork descriptions. |
| Print / PDF | A system print proof with selectable interior text and an optional full cover spread. |

The EPUB builder packages embedded cover photos and manuscript image data in the
archive. Reader navigation points to the generated XHTML sections. See
[EPUB 3.3 navigation](https://www.w3.org/TR/epub-33/#sec-nav-toc).

`manuscriptTitleHtml(title, layout, level = 2)` is the shared plain-title renderer
for export previews, the print portal, HTML and EPUB. It escapes title text and
applies `titleStyleForLayout` character and paragraph declarations inline so
section overrides and preview heading CSS cannot replace the selected design.
Hard line breaks remain visible. Word's `Title` paragraph style uses the same
resolved book typography, color, alignment, indents and spacing; titles retain
literal Markdown characters and use Word line breaks. Word keeps its existing
chapter-number prefix and book-wide layout limitations. Decorative rules,
borders and shading are supported in HTML/EPUB/print; Word's existing style
conversion remains a subset. See [title editing](STUDIO_MANUSCRIPT.md).

`saveBookExport` opens the Tauri save dialog, builds the selected file, and
writes to the chosen path. Cancellation returns `null`. After a successful
write, the receipt provides the filename, byte count, and path for **Show file**.
The browser fixture uses a Blob download and omits the path.

## Print and verification

`PrintBook` renders into a print-only portal. The print action rasterizes a
layered cover at up to 300 DPI within a 12-million-pixel budget. The image fits
the sheet at its original aspect ratio. Interior pages keep selectable text and
section breaks. Engines that support named page sizes can use the cover and
manuscript dimensions from CSS. macOS uses the paper size selected in the
system print dialog. Cover Designer's production PDF uses the wrap's dimensions.

Run `npm test`, `npm run build`, and `git diff --check`. Run `npm run dev`
and open `/cover-preview.html?screen=library` or
`/cover-preview.html?screen=export` in an isolated browser profile. Compare the
library's full wrap with the front-only ebook proof. Change the inclusion options,
export each format, and inspect the saved assets and navigation. For print, check
that the cover occupies one page and that interior text remains selectable.

Use an isolated Tauri fixture for the native save, cancel, and print dialogs.
These checks exercise filesystem and printing permissions with sample data.
Test SQLite writes separately through the Rust migration and command tests.
