# Manuscript checkpoints and recovery

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
