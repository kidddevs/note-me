# Section planning

Books Studio's **Section plan** tracks editorial work independently of manuscript
text, page design and the book's publication status. Cards represent sections,
which can contain more than one printed page; this is not a pagination or imposition
preview.

## Workflow

- Open **Section plan** from Workspace, the command palette, or Cmd/Ctrl+7.
- Pick a section to edit its Draft/Revising/Ready status, word budget and due date.
  Use **Save section plan** before switching sections or leaving the form. Errors
  retain the current form draft and the previously saved plan remains visible on
  the card. A changed saved plan exposes **Reload saved** while editing a draft.
- **Write** and **Open in manuscript** open that exact section. The editor's status
  button opens the same planning form, with keyboard save, Escape and focus return.
  The outline displays the saved status. Export Studio links back to the section
  plan and reports how many sections have explicitly been marked ready.
- Search matches all query terms across titles, section types and sanitized writing,
  including text beyond the visible excerpt. Filter by stage, manuscript band or
  overdue work, then sort by document order, deadline, title or actual word count.
- Word budgets are targets, not maximums. Reaching a budget never changes editorial
  status. Zero/blank means no section budget. The book's existing word goal is
  separate from the sum of section budgets.
- Due dates use local calendar days, not UTC instants. A pending section becomes
  overdue the day after its due date; Ready sections are never overdue. The planner
  refreshes its day on window focus and once per minute. It sends no notifications.

## Persistence and native API

`book_chapters.workflow_json` is a new `TEXT NOT NULL DEFAULT '{}'` column. Startup
adds it when missing using the existing additive migration mechanism. Repeated
migrations retain manuscript content, page layout and existing plans. No database
is dropped or replaced. JavaScript's optional `Chapter.workflow_json` supports old
records and fixture objects; the native `Chapter` response always includes it.

The stored object has three fields:

```json
{"status":"revising","wordGoal":1800,"dueDate":"2026-12-01"}
```

`update_chapter_workflow(id, workflow_json)` validates and writes that column plus
the section/book modification times in one SQLite transaction. It returns the
updated `Chapter`. Status must be `draft`, `revising` or `ready`; the budget must be
an integer from 0 to 1,000,000; a date must be empty or a real `YYYY-MM-DD` calendar
date between years 1000 and 9999. Invalid JSON/types, impossible leap dates, unknown
sections and failed book updates cannot partially save planning data.

The command does not write title, content, section kind, contents inclusion, heading
exclusions or page layout. Reader exports do not include planning metadata.

Native changes require restarting/rebuilding the desktop app to load the command
and run startup migrations. Browser-only Vite refresh does not update Rust.

## Frontend contracts

| File | Responsibility |
| --- | --- |
| `src/lib/bookWorkflow.ts` | Defaults, strict write validation, date handling, planning entries, filtering and totals |
| `src/components/BooksStudioPlan.tsx` | Planner, cards, filters, summary, section navigation and new-section entry |
| `src/components/BookWorkflowControls.tsx` | Shared form, status badge and writing-surface popover |
| `src/store/books.ts`, `src/lib/api.ts` | Serialized saves, field ownership and typed native bridge |
| `src/lib/bookWorkflowWrites.ts` | Independent section-plan write queue |
| `src/lib/bookStudioClose.ts`, `src/components/BookStudioWriteGuard.tsx` | Registered draft savers and one app-wide native close owner |
| `src-tauri/src/book_workflow.rs` | Native validation and transactional persistence |
| `src-tauri/src/db.rs`, `models.rs`, `commands.rs` | Additive schema, chapter response and registered command |

- `parseChapterWorkflow(raw)` tolerates missing/malformed legacy JSON and supplies
  defaults for display. It never rewrites the stored record. Bad budgets are bounded;
  unsupported stages become Draft and invalid dates become empty.
- `chapterWorkflowError(workflow)` returns a user-facing validation error or `null`.
  `serializeChapterWorkflow(workflow)` validates strictly before serializing known
  planning fields. Add future fields to both the TypeScript and native contracts.
- `localDateKey(date?)` builds a day from local date parts. `validWorkflowDate` checks
  the Gregorian calendar without time-zone parsing, including leap centuries.
- `chapterPlanEntries(chapters, today?)` respects document bands/order and produces
  actual words, a short excerpt, full normalized search text, budget progress and
  deadline flags. The optional day makes tests deterministic.
- `filterChapterPlan(entries, options)` combines search/status/band/deadline filters
  and returns a new sorted array. Undated sections sort after dated ones. The source
  array and persisted document order remain unchanged.
- `chapterPlanSummary(entries, book)` reports counts, actual words, budgeted words,
  budgeted section count and the independent book word goal.
- `plainTextContent` in `bookPublishing.ts` is now exported for source summaries.
  It replaces embedded media/rich blocks with text and removes portable canvas
  metadata; it retains ordinary Markdown markers. The planner also simplifies
  those markers for its excerpt/search text and never indexes embedded image bytes.

`useBooks.updateChapterWorkflow(id, workflow)` copies validated input, queues writes
per section and updates state only after acknowledgement. It merges confirmed
workflow/timestamp fields into the current chapter instead of replacing an older
whole-chapter snapshot. Pending saves cannot overwrite newer writing or layout, or
replace a chapter from a newly selected book. Failed saves do not block later ones.

`queueChapterWorkflowWrite` serializes native calls per section. Independent sections
can save concurrently. `hasPendingChapterWorkflowWrites` reports in-flight or queued
writes; `flushChapterWorkflowWrites` waits for pending writes, including ones added
while waiting, and rejects on a failed write.

`registerBookStudioCloseTask({hasChanges, save})` registers a writing/settings draft
saver and returns its cleanup function. A saver must reject failures and clear only
the revision it confirmed; changes made during its save remain dirty for the next
pass. `flushBookStudioCloseWork` drains these tasks and plans, watching plan failures
before waiting for a slower writing save. `createBookStudioCloseHandler` prevents
repeated close requests while draining, closes once after success, and surfaces
failure while leaving the window open.

`BookStudioWriteGuard` owns the **only** native `onCloseRequested` listener, mounted
in `App` so submitted plans remain protected after switching to Notes. Tauri gives
each listener its own automatic destroy behavior, so additional surface-level close
listeners can bypass another listener's cancellation. Register a draft saver instead.
Settings close saves join an existing settings write before checking newer changes.
Unsaved planning form drafts still require explicit Save. Native close behavior
needs desktop smoke testing; tests simulate Tauri's per-listener automatic close.

Writing saves resolve omitted kind/contents fields from the existing section.
Writing/layout failures restore only their owned fields. Reorder rollback restores
positions only while its optimistic order is still current; failed deletion
restores the removed section while preserving changes on remaining sections.

## Development fixture and verification

`/cover-preview.html?screen=plan` opens the real planner. Fixture navigation also
supports manuscript, cover and outline screens. Fresh fixtures start with three
sections. An intentionally empty saved fixture stays empty across reload.

The fixture uses book `-701`, reserved section ids `-702` through `-799` and the
separate `noteme-cover-preview` IndexedDB store. Its typed API adapters exercise the
production chapter Zustand actions. Fixture writes use atomic field patches so
content, page layout and planning cannot replace each other's data.

`loadCoverPreviewChapters`, `createCoverPreviewChapter`, `patchCoverPreviewChapter`,
`reorderCoverPreviewChapters`, `deleteCoverPreviewChapter` and
`clearCoverPreviewChapters` operate only on fixture records. The original
`loadCoverPreviewChapter(id = -702)` and `saveCoverPreviewChapter(null)` retain their
primary-section behavior; clearing all fixture chapters is a separate operation.
Never clear a real user's books, library or database for QA.

Run `npm test`, `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
and `git diff --check`. Regression tests cover date validation, migration/row
preservation, transactional failure, source privacy, planning queues and rollback
ownership. Browser checks should cover save/reload, failure and retry, filters,
section creation/reordering, editor/outline integration, focus, and narrow layouts.
Native SQLite tests use in-memory databases. Browser fixture checks do not prove
native window navigation, startup against a user's database or native dialogs.

### Verified November 8, 2026

- `npm test`: 203 Node regressions and 9 Rust tests passed, including TypeScript
  compilation, per-section queues and close flushing, migration preservation,
  native transaction rollback and chapter response fields.
- `npm run build`, Rust formatting and `git diff --check` passed. Vite reports a
  non-fatal size advisory for the existing Books Studio bundle.
- Isolated browser checks passed for save/reload, injected storage failure and
  retry, external-save conflict/reload, combined search/filtering, section creation
  and reorder persistence, manuscript popover keyboard save/focus return, outline
  badges, and empty-book recovery. Concurrent fixture patches preserved writing,
  layout and plan; positive-id mutations were rejected.
- Dark and light rendering were inspected. Widths of 375, 680, 1024 and 1440px had
  no horizontal overflow; selecting a card in a narrow window focused its details.
- QA mutations were cleared from the negative-id fixture and a fresh three-section
  fixture was restored. User books, artwork and native databases were untouched.
- Native window close, native startup and native export dialogs were not exercised.
  Export metadata privacy is covered by Node publishing tests; the new readiness
  navigation is compiled but has not been checked in the desktop UI.
