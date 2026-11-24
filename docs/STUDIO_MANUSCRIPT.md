# Manuscript editing and recovery

## Manuscript navigator and workspace handoffs

**Navigate** opens a keyboard-accessible section and heading map. It includes
sections and headings hidden from reader contents without changing their inclusion.
Filter by section title/type or heading text, then open the section title or the
matching text frame. Rows show current section words and saved planning status.
Arrow keys move through results, Enter opens a result, and Escape closes the
dialog and returns focus to its trigger. Queries remain available while the
editor stays mounted; section filters and prose searches are independent.

**Find in book**, also Cmd/Ctrl+Shift+F, searches prose across the selected book.
It shares section Find's literal, case and Unicode whole-word matching. The active
section's unsaved title/content replace its saved copy in the navigator. Snippets
stay inside readable prose runs, excluding image bytes, layout attributes, link
targets and fenced code. Results retain exact counts but render at most 200 rows;
refine the query for larger result sets. There is no whole-book replace action.

Opening a prose result opens that section's existing Find bar with its query,
options and exact current match highlighted. Focus lands in Find for keyboard
navigation or the existing section-scoped Replace controls. A changed source is
searched again and falls back to its first current match with an explanation;
stale source offsets never become replacement commands. Results do not persist
or alter the manuscript until the user edits text normally.

The navigator's **Section plan** and **Export studio** links, plus the editor's
Outline, settings and Previous/Next controls, save the latest writing draft before
leaving. They wait for pending checkpoint restoration and save again if a newer
draft arrives during a write. A failure retains the draft and current section;
the navigator shows an inline retryable error. These transitions do not create
manual checkpoints. This guard covers these editor controls; it does not add a
global navigation guard to unrelated application controls or flush Notes.

Outline's generated contents now opens headings at their text frames instead of
only opening the containing section. Normal section actions retain their existing
behavior. Page placement, section order, contents choices and planning data are
unchanged by navigation.

Implementation contracts:

- `ManuscriptDestination` distinguishes title, heading-key and prose-result targets.
  `ManuscriptLocation` adds book/section identity. The workspace and development
  fixture pass these transient requests through the same editor props; they are
  never saved to SQLite or settings.
- `manuscriptSections(chapters, query?)` orders/filter sections and headings, including
  ones omitted from reader contents. It does not mutate source records.
- `searchBookManuscript(chapters, query, options?, limit = 200)` returns exact
  `total`, bounded `shown` and per-section counts/matches with plain-text excerpts.
- `resolveManuscriptDestination(content, destination)` resolves a current text
  block and search index. Missing headings fall back to the section title.
- `manuscriptMatchExcerpts(content, matches, radius = 56)` parses blocks once and
  returns corresponding `{before, match, after}` objects or `null` for invalid
  ranges. It preserves surrogate pairs at snippet boundaries.
- `extractMarkdownHeadings` now supplies original UTF-16 source `start` offsets,
  including CRLF. Display labels omit canvas layout comments. Its existing key
  format retains those comments when present so saved heading exclusions remain
  compatible; navigating never rewrites them.

Use fresh `/cover-preview.html?screen=manuscript` fixtures for search, headings,
keyboard focus, draft-save failure/retry, delayed-write edits, Replace/undo,
Outline and planning/export handoffs. Never use user notes or a native database
for these checks. Browser results do not prove native desktop navigation.

## Titles and paragraph presets

Focus the section title to open its **Paragraph style** picker. Titles can use,
create, rename, duplicate and delete presets from the same library as body text.
The assignment applies to titles throughout the book. Editing a linked preset
also updates body frames that use that preset; choose **New** or **Duplicate**
before making a separate title design. **Role default** returns to the base title
style. Creating or duplicating a title preset saves its assignment and definition
in one layout update.

Titles remain plain text in `chapters.title`, separate from body Markdown. Their
textarea wraps and grows with the title and page width. Paragraph controls cover
indents, spacing, alignment, leading, tabs and pagination; character controls,
rules, borders and shading also apply. Prose-only columns, drop caps, nested
openings, bullets and GREP are omitted from titles, including when inherited
from a body preset. The underlying preset is preserved for its body users.
Cmd/Ctrl+B, I and U toggle the title's shared style. Cmd/Ctrl+S saves the section;
Cmd/Ctrl+Z and Shift+Z use manuscript history for title text and style changes.

`BookLayout.titleStyleId` stores the preset reference in existing layout JSON.
`titleStyleForLayout(layout)` returns the resolved title style with prose-only
effects disabled; missing or deleted references fall back to `typography.title`.
`patchTitleStyle(layout, patch)` immutably edits the linked preset or the base
title role. It leaves body content and unrelated styles unchanged. No database
migration is needed. Unconfigured titles/headings keep their role sizes and
leading instead of inheriting the body size. New title defaults include space
after and keep-with-next; explicit saved values still win.

`estimateBookPagination(book, chapters)` turns the selected trim, page margins,
body leading, columns, generated contents, and section-level overrides into an
interior-page planning estimate for Export Studio. It intentionally does not
claim exact browser or print pagination: font metrics, image flow, widow/orphan
resolution, and the target application's layout engine still require a final
proof. Export preflight calls out combinations such as a forced break paired
with a keep-together rule before a reader copy is saved.

## Prose find and replace

Open Find with the toolbar search button or Cmd/Ctrl+F. Cmd/Ctrl+Alt+F opens the
replacement row. Matches appear on the page, with a stronger highlight for the
current result. Enter and Shift+Enter move forward and backward with wraparound.
The query keeps focus while navigating. Escape closes Find and focuses the current
text frame. With no current match it returns to the selected frame or search
button. Changing sections clears the query and closes the bar.

**Match case** and **Whole words** combine. Word boundaries recognize Unicode
letters, numbers and combining marks, along with underscores and apostrophes.
Queries are literal, not regular expressions. Search covers prose in text frames,
including headings, quotes, list items, styled text and link labels. It excludes
section titles, artwork/captions, link destinations, structured tables/charts/
callouts, fenced code, Markdown markers and portable layout metadata. Phrases must
stay in one contiguous formatting run, so `quiet **shore**` is found by searching
`quiet` or `shore`, not `quiet shore`.

**Replace** changes the current match and advances past the inserted text, even
when the replacement contains the query. **Replace all** affects only matching
prose in this section. Replacement strings are inserted literally without regex
substitution, and the normal manuscript Markdown rendering still applies. Each
action creates one editor undo step and saves through the existing autosave path.
Feedback reports how many matches changed. No matches disables replacement.

`src/lib/bookManuscriptSearch.ts` owns these public utilities.

- `findManuscriptMatches(content, query, {matchCase?, wholeWord?})` returns ordered,
  non-overlapping `{start, end, blockStart}` source ranges. It derives editable runs
  from `canvasBlocks`, keeping offsets in the original UTF-16 source. Unicode regex
  matching avoids offset drift from lowercasing characters with different lengths.
- `replaceManuscriptText(content, query, replacement, options?, index?)` recomputes
  ranges against that revision and returns `{content, count, nextIndex}`. Omit the
  index for all matches. Invalid indices and empty/whitespace queries change
  nothing. The input and all bytes outside the selected ranges stay unchanged.
- `highlightManuscriptMatches(source, matches, blockStart, activeStart, render)`
  accepts that block's current, ordered match subset and a publishing-renderer
  callback. Temporary private-use markers locate the exact source occurrences;
  the returned HTML marks text fragments while retaining nested typography spans.
  This HTML belongs only in the read-only preview. ContentEditable initialization
  always uses the original source, and highlights never enter saved Markdown.

The search controls wrap within narrow windows. The editor's flex container must
retain `min-width: 0` so its fixed-size page and toolbars cannot stretch the search
bar beyond the window.

## Checkpoints

The manuscript's **History** button opens local version history for the active
section. **Save checkpoint** preserves its current title and portable content,
including unsaved writing. **Preview** renders the complete checkpoint beside
the current draft without changing either. Matching checkpoints cannot be
restored. The comparison uses the shared Markdown renderer rather than an exact
page proof or tracked-change diff.

Automatic checkpoints check for title or content changes every two minutes while
the section is open. They compare against the latest checkpoint, independently
of the 700 ms writing autosave. An unchanged section produces no new automatic
copies. Manual checkpoints can intentionally capture the same text again.

**Restore** asks for confirmation. It saves the current draft as **Before restore**
and replaces the section's title and content in one transaction. Any failed write
rolls back both changes. The confirmation keeps errors visible for retry.
Successful restores form a normal editor undo step. The latest 50 checkpoints per
section are retained, including safety copies. These are local recovery versions,
not a substitute for an external backup.

## Native and frontend contracts

- `api.restoreChapterSnapshot(chapterId, snapshotId, { title, content, wordCount })`
  invokes `restore_chapter_snapshot` and returns the confirmed `Chapter`.
- `src-tauri/src/book_snapshots.rs` validates that the checkpoint belongs to the
  requested section and book. It reads the source before pruning, inserts the
  supplied safety draft, updates section text and book/section timestamps, prunes
  history, and commits. It leaves section kind, contents choices, page design and
  editorial planning intact. No schema migration is needed.
- `useBooks.restoreChapterSnapshot` copies the draft before queuing. It merges
  only confirmed text/timestamps and never replaces a newly selected book's
  sections or writing submitted after the restore request.
- `queueChapterWrite(id, write)` in `bookWorkflowWrites.ts` serializes writing,
  editorial planning and restores for that section. An earlier autosave must
  finish before a restore starts. Later writes still run after a failure.
  Separate sections can save concurrently. The legacy workflow queue and close
  functions retain their names and now cover these operations too.
- `ManuscriptScreen` guards history requests with section-session and request
  tokens. Late list/create/delete responses cannot populate another section's
  history. Restores wait for the native result before changing the visible draft.
  Newer writing stays open and resumes autosave after the restore finishes.
  Navigation cleanup must not resubmit the draft currently being restored.
- `ManuscriptHistory.tsx` owns comparison selection, dialog focus containment and
  focus return. History and confirmation keyboard events stay within their dialog.
  Keep feedback icon based and retain the existing light/dark studio styling.

The app-wide close guard tracks queued writes even after leaving the editor. The
editor also registers its pending restore and dirty draft with the close task
registry. A close request waits for these operations and stays open on failure.
See [Section planning](STUDIO_PLANNING.md) for close ownership and plan contracts.

## Safe browser fixture

Run `npm run dev -- --host 127.0.0.1` and open
`http://127.0.0.1:1420/cover-preview.html?screen=manuscript` in a disposable browser
context. Add `&theme=light` for light appearance. The fixture only uses book
`-701`, sections `-702` through `-799`, and `noteme-cover-preview` IndexedDB.
It never opens the native database.

`bookSnapshotPreview.ts` provides `listPreviewSnapshots`, `createPreviewSnapshot`,
`deletePreviewSnapshot` and `restorePreviewSnapshot` with the native API's call
shapes. Restore and its safety copy share one IndexedDB transaction. Records use
`snapshot-<id>` keys in the existing `books` object store. Section deletion removes
its fixture checkpoints. `openCoverPreviewDatabase()` opens this development
database and the caller must close it. Import these helpers directly for QA;
do not re-import the page bootstrap and mount another React root.

## Verification

Run the standard checks.

```bash
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
git diff --check
```

The store regressions exercise restore ordering,
copied safety input, metadata ownership, failure/retry, newer writing and book
switching. Rust tests use in-memory SQLite to verify rollback, cross-section
rejection, safety contents and oldest-checkpoint retention.

Browser checks should exercise these interactions in the isolated fixture.

1. Save a checkpoint, change both title and body, then preview both full drafts.
   Preview must leave the current title and content unchanged.
2. Restore, reopen History and verify **Before restore** holds the previous title
   and body. Undo/redo should traverse the restore. Reload and check persistence.
3. Inject a restore failure at the fixture API boundary. The draft and history
   count must stay intact, and the confirmation must offer a working retry.
4. Let writing autosave, advance the browser clock by two minutes, and check that
   an automatic checkpoint appears. Another unchanged interval adds none.
5. Delay history loading and switch sections. Resolve the old response and verify
   the new section's history stays isolated. Delay restore and navigate to a
   different section; its writing must remain independent of the restored text.
6. Check list-load retry, Tab containment, Escape from confirmation, focus return,
   both themes, and the 375 px layout with independently scrollable comparison.

Fixture checks validate React/store/IndexedDB integration. Rust tests validate
SQLite transactions. Neither claims a native desktop interaction check. Rebuild
the Tauri application before testing the new native command on a real manuscript.

Validated November 19, 2026 with 229 Node tests, 12 Rust tests, the production web
build, formatting and diff checks. Isolated browser checks covered draft preview,
safety restore, failure/retry, undo/redo, checkpoints after autosave, delayed history
and restore across section navigation, retention/deletion, focus and mobile themes.
The native application was not reinstalled or exercised in this pass.

## Prose search verification — November 22, 2026

`tests/book-manuscript-search.test.cjs` covers protected source ranges, Unicode
offsets and word boundaries, literal queries, formatted runs, fenced code, regex
replacement characters, replacement navigation and preview HTML with nested
typography. Browser checks use only the isolated fixture described above.

Exercise case/word combinations, Enter/Shift+Enter, single replacement and Replace
all, individual undo/redo, autosave/reload, Escape focus return and section changes.
Enter and leave a highlighted text frame to verify no highlight markup enters
ContentEditable or persisted text. Compare artwork, destinations and layout bytes
before and after replacement. Check dark/light themes and 375/1024/1440 px widths.
These checks exercise the React/store/fixture path and do not establish native
Tauri interaction results.

Validation passed with 238 Node tests, 12 Rust tests, the production web build and
the diff check. The existing Vite chunk-size warning remains. Isolated browser QA
covered the interactions above, including byte-preserving media/layout handling,
one-step undo/redo, autosave/reload and all search controls fitting at narrow widths.
No native app was reinstalled and no user database was changed.
