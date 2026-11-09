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
cover artwork shows its colour and genre.

## Edition and save

`bookForExport` resolves cover and contents from manuscript defaults plus
the current choices. Export Studio keeps those choices in the mounted screen
for one manuscript. Use **Use manuscript defaults** to reset them. Preview,
preflight, and the file builders read the same resolved edition.

`bookPackageSummary` reports section readiness, generated contents, and how the
format handles placed manuscript artwork. It counts artwork blocks and whether
credits are present. `bookExportChecks` links missing metadata, empty sections
and contents gaps to settings, writing, or Outline. An empty manuscript blocks
export. Other findings guide review.

| Format | Output |
| --- | --- |
| EPUB 3 | Reflowable chapters, optional front cover, and reader navigation. If generated contents are omitted or empty, navigation opens the title page via **Start reading**. |
| Styled HTML | One styled document with optional front cover and linked contents. The file builder embeds bundled cover photos. |
| DOCX | Editable text and styles, compatible embedded images, and captions and credits. Other image sources become text descriptions. |
| Markdown | Source with book metadata, image references, and portable layout attributes. |
| Plain text | Section text and artwork descriptions. |
| Print / PDF | A system print proof with selectable interior text and an optional full cover spread. |

The EPUB builder packages embedded cover photos and manuscript image data in the
archive. Reader navigation points to the generated XHTML sections. See
[EPUB 3.3 navigation](https://www.w3.org/TR/epub-33/#sec-nav-toc).

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
