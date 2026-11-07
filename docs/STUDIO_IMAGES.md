# Shared studio images

The manuscript editor and cover designer use one local image library. Keep the
source, placement, crop, and publishing paths connected when adding image tools.

## User workflow

- **Cover designer:** the image tool (`I`), the Layers add-image control, and the
  empty canvas image action open **Studio image library** to add a new layer.
  **Browse studio images** in Image lab replaces the selected image; in Background
  it replaces the pinned wrap image. The dialog names the action before placement.
- **Manuscript:** open **Insert artwork → Studio image library** to place an image.
  The existing artwork drawer still includes graphics and direct file upload.
  **Replace artwork** preserves the selected image's frame, crop and caption.
- Both image inspectors and the background inspector can **Save image to studio
  library**. This saves the original source with its details. Crop, grading, erasure,
  frame shape and other placement effects remain in the document.
- Search matches all query words across name, alt text, credit, source notes and
  tags. Shape filters use recorded pixel dimensions. Favorites provide a shortlist.
- Edit details in the shelf. Save explicitly, or let selecting another photo,
  placing, or closing the dialog save them first. Failed saves retain the draft
  and offer an explicit close without saving.
- Removing a library copy has an inline confirmation. Placed artwork stays embedded
  in its document and does not depend on the library entry remaining available.

New placements copy metadata; editing the shelf does not silently rewrite existing
books. Photo credit is visible below manuscript images. License/source notes stay
with editable content. Cover source notes accompany the production ZIP in
`*-image-credits.txt`, without painting credit text over a designed cover.

## Source map

| File | Responsibility |
| --- | --- |
| `src/lib/bookImageLibrary.ts` | IndexedDB, normalization, source decoding, duplicate detection and search |
| `src/components/BookImageLibrary.tsx` | Shared shelf, details, filters, upload, placement and save-source button |
| `src/components/CoverImageFocus.tsx` | Shared pointer/keyboard focal control for pages, cover layers and backgrounds |
| `src/components/BooksStudioEditor.tsx` | Page placement, image replacement, paste/drop and live rendering |
| `src/components/BooksStudioInspector.tsx` | Page crop, frame, metadata and save-source controls |
| `src/components/BooksCoverStudio.tsx` | Cover/background placement and source metadata |
| `src/lib/bookPublishing.ts` | Portable Markdown, image presentation, HTML/EPUB/print and Word credits |
| `src/lib/bookCoverPackage.ts` | Production credits report |

## Library contracts

The existing IndexedDB database `book-studio-image-library`, version 1, and its
`cover-images` store remain unchanged. Optional record fields need no database
migration. `CoverImageAsset` adds normalized `alt`, `credit`, `license`, `tags`,
`favorite` and `updatedAt` values. Legacy records receive empty metadata, no
favorite and their original creation time as the update time when read; reading
never rewrites them. Normalizers reject records without a source or id, clamp
invalid dimensions to zero and bound metadata lengths.

- `normalizeCoverImageDetails` bounds alt text to 500 characters, credit to 240,
  source notes to 500, and tags to 12 distinct entries of at most 32 characters.
  Tag identity is case-insensitive. Text fields are single-line.
- `prepareCoverImageAsset(input, existing, now, id)` is a pure, immutable operation.
  Identical source strings reuse the existing id, creation time and display name.
  Omitted or `undefined` details preserve existing values; explicit empty values
  clear them. Known dimensions survive an input with unknown dimensions.
- `saveCoverImageAsset` performs duplicate detection, the capacity check and the
  write in **one read/write transaction**. Concurrent saves cannot create duplicate
  entries for a newly uploaded source or evict another photo. Existing duplicates
  are left alone. The capacity remains 24 sources; a full library returns `null`
  for a new source and retains every existing entry. Reusing a source still works.
- `updateCoverImageAsset(id, patch)` changes only name/details, never pixels or id.
  Saves and updates return a record only after the transaction commits. Failure or
  a missing record returns `null`; delete returns `false` on failure. Reads return
  an empty list when storage is unavailable.
- Successful mutations dispatch `IMAGE_LIBRARY_CHANGED` on the current window.
  Mounted cover quick-picks and the shared shelf refresh from committed records.
- `filterCoverImageAssets(assets, query, orientation, favorites)` preserves input
  order. Square means a width/height ratio within 0.95–1.05. Unknown dimensions
  appear under All shapes only. Reads sort by updated time, then display name.
- `readBookImageFile(file)` supports PNG, JPEG, GIF, WebP and SVG up to 16 MB, embeds
  the source and decodes real pixel dimensions. It seeds editable alt text from
  the file name. Decode/type/size failures reject before placing anything.
- `readBookImageSource(src)` decodes dimensions. `readPortableBookImageSource(src)`
  additionally embeds app-relative or remote sources for the save-source action.
  Remote sources must permit browser fetch access; failures report an error and
  leave the document intact.

The shared dialog offers **Place without library copy** if saving an upload fails.
That embeds the image in the target page, layer or background without dropping an
existing library image. Direct manuscript upload/paste/drop likewise places the
image even if the optional library copy cannot be stored.

## Page image and publishing contracts

`ImagePresentation` adds optional normalized focus (0–1), original pixel dimensions,
credit and source notes. Portable image attributes are `fx`, `fy`, `sw`, `sh`,
`credit` and `license`; text values use URI encoding. Older Markdown keeps centered
focus and works without source dimensions.

- `imageMarkdownFromAsset(asset, presentation?)` embeds the source and copies its
  dimensions, credit, notes and alt text into the Markdown image block.
- `replaceImageMarkdown(original, replacement)` preserves original placement,
  width/height, stacking, crop, frame and caption, while replacing source pixels,
  dimensions, alt text, credit and notes. It returns `null` for non-image input.
  Uncredited replacements clear old attribution. UI callers reject stale section
  or block targets rather than overwriting edits made during asynchronous reads.
- `imageFrameAspectRatio(presentation)` prefers explicit width/height, then the
  chosen aspect preset, then original pixel dimensions. Height and Y position use
  the page content width as their unit. The shared focal preview uses this ratio.
- Pointer dragging, arrow keys (Shift for larger steps), Home and Center all write
  the same focal values. The canvas and HTML/EPUB/print renderers use them for
  `object-position`. Frame heights, radius, border, shadow, rotation and opacity
  also travel into the HTML presentation. Selection chrome adds no image padding.
- Credits render as escaped literal text below the image, even when the caption is
  empty. Word retains the credit in its caption paragraph. Notes are stored in
  Markdown but are not printed in the image caption.
- Image attributes are parsed before inline emphasis/link formatting and escaped
  once. Markdown punctuation in names, URLs or credits must not corrupt attributes
  or the XHTML used by EPUB.

Word currently exports the embedded source with its caption/credit; it does not
reproduce page focal crops or all frame effects. Free-layout X/Y placement and
full-bleed pagination across output formats remain separate roadmap work.

## Cover metadata and production

`CoverImageLayer` and `CoverBackgroundImage` accept optional `alt`, `credit` and
`license` strings on version-1 cover documents. Normalization, layout JSON,
`.bookcover` interchange, history and clipboard copies preserve them. Background
lifting and copying a photo to the background retain source details. Replacing a
photo clears the old painted erase mask and swaps attribution with the source.

`coverImageCreditsText(book, cover)` lists the pinned background and visible image
layers, respecting hidden groups. Missing attribution is labelled Not supplied;
source data URIs are never copied into the text report. `createCoverPackage` adds
the credits file alongside its existing PDF, panels, mockup, specs and preflight.

## Development and verification

```bash
npm run dev -- --host 127.0.0.1
npm test
npm run build
git diff --check
```

Use `http://127.0.0.1:1420/cover-preview.html` and the fixture navigation to switch
between the real manuscript and cover editors. `?screen=manuscript` starts with the
page canvas; `?theme=light` selects light appearance. The negative book/section ids
(-701/-702) use the isolated `noteme-cover-preview` IndexedDB store. The
`loadCoverPreviewChapter`/`saveCoverPreviewChapter` helpers complement the existing
book helpers. Passing `null` to the chapter save helper clears that fixture alone.
No native database is opened. The fixture does not validate native checkpoint,
navigation, close handling or file-dialog behavior.

Regression checks should include duplicate/concurrent uploads, capacity without
eviction, metadata save failure, placement without a library copy, search/favorites,
keyboard focus trapping and return, mobile containment, metadata reload, page crop
and credit rendering, replacement preserving geometry, undo, and removal of a
library copy while placed artwork survives. Test the cover credits ZIP and the
HTML, EPUB, print and Word output paths separately. Use disposable browser data;
never clear a real user's library or manuscript for QA.

Verified on November 7, 2026: `npm test` passed 167 Node tests and 5 Rust tests;
the production build and whitespace check passed. Browser fixture checks covered
shared placement, metadata reload and failed-save retry, search and favorites,
keyboard focus, 375-pixel and short-window containment in both themes, crop
rendering, replacement with undo/redo, and library removal preserving placed art.
Concurrent IndexedDB saves respected the 24-source limit without eviction;
direct placement still worked when full. A downloaded production ZIP contained
the PDF, panel images, mockup, specs, preflight and image-credits report. These are
fixture and automated checks; a native Tauri UI smoke test remains outstanding.
