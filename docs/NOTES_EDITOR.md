# Notes editor spacing and saves

Notes may contain credentials. Do not inspect, export, query or alter user notes
to reproduce editor bugs. Do not launch the normal application for automated QA
unless its data and clipboard access are explicitly isolated. Use synthetic data
in the development fixture below.

## Spacing contract

Notes use the shared application text palette in both themes. The existing
small/medium/large preferences now map to 14/16/18 px, with 16 px as the default
for Markdown, rich text and preview. This changes presentation only; it does not
rewrite content or spacing. See [UI readability](UI_READABILITY.md).

`notes.content` remains Markdown in the existing SQLite table. There is no schema
change, migration of user content, additional persistent draft storage or automatic rewrite
of existing notes.

`src/lib/noteRichtext.tsx` owns the Notes-specific render/serialize pair.

- `NoteMarkdown` is shared by split/preview and the rich editor's initial HTML.
  `noteMarkdownToHtml(source)` renders the same component to static HTML.
- `remarkNoteSpacing` makes soft line breaks explicit and inserts one empty row
  for every authored blank line, including leading/trailing blank rows. Prose
  indentation and repeated spaces remain visible. Fenced code keeps its own
  whitespace and raw HTML remains disabled.
- The HAST pass removes the formatter newline emitted after BR nodes, preventing
  `white-space: break-spaces` from displaying every break twice. Continuation
  indentation is restored after the Markdown handler's whitespace trimming.
- `.note-markdown` removes ordinary paragraph margins and preserves prose spaces.
  Explicit blank-row elements supply vertical gaps. It does not restyle Books
  Studio or change the manuscript renderer.
- `noteHtmlToMarkdown(html)` preserves visual line boundaries and spaces through
  Turndown with collision-checked temporary tokens. It understands browser DIV/P
  lines, empty blocks and caret placeholders represented by trailing BR or LF.
  Tokens and DOM attributes never enter stored Markdown. Native nonbreaking
  spaces and Unicode characters remain intact.
- Plain Enter/Shift+Enter in prose inserts a line break. Lists, quotes, code and
  headings keep their native semantic editing behavior.
- `RichTextEditor` compares the live HTML with its last emitted/rendered HTML.
  Merely focusing, blurring, switching modes or closing a tab does not reserialize
  untouched Markdown. Note identity keys reset the rich editor when changing notes.

`createMarkdownConverter(options?)` in `richtext.tsx` creates the shared Turndown
rules. Its existing `htmlToMarkdown` and `markdownToHtml` contracts remain unchanged
for manuscript editing. Notes use the separate spacing-aware functions above.
Actual rich edits can canonicalize Markdown notation, such as bullet indentation,
while preserving the rendered structure.

## Save and close contract

`createNoteSaveQueue(write, onError?, delay?)` in `noteSaves.ts` creates a tested
queue. `noteSaves` is the application instance using the typed `api.updateNote`.

- `stage(id, {title, content, categoryId})` copies the draft and debounces for 600 ms.
  Drafts live in memory outside the editor, so closing or switching tabs cannot
  discard pending content or retarget a timer to a different note.
- `flush(id)` joins an in-flight write and saves revisions staged during it in
  order. Different notes can save concurrently. `flushAll()` waits for all notes,
  including changes arriving during saving. Failed writes reject and retain the
  latest draft for retry. A synchronous writer failure also permits retry.
- `get(id)`, `status(id)`, `hasPending()` and `subscribe(listener)` expose current
  pending state without reading the database. No content is logged.
- The editor updates its cached note optimistically, subscribes to queue state,
  shows **Retry save** on failure, and flushes its original note id on unmount.
  Reopening a pending note reads the queued draft first.
- `useNotes.refresh` merges pending drafts into responses. A request revision
  guard discards older refresh responses, preventing a stale list from replacing
  newer confirmed content.
- The existing app-wide `BookStudioWriteGuard` remains the only native close
  owner. Despite its historical name, `bookStudioClose.ts` drains both Notes and
  Studio writes. A failure keeps the window open. The macOS application-menu
  **Quit NoteMe / Cmd+Q** requests this normal window-close path. Its final destroy
  action has an explicit `core:window:allow-destroy` capability.

Do not add another native close listener. Keep this queue in the shared close
drain when extending Notes, Books Studio or workspace switching.

## Synthetic browser fixture

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:1420/notes-preview.html` in a disposable browser context.
Use `?theme=light` for light appearance. This entry is development-only and is
excluded from the production Vite entry.

The fixture mounts the real `Editor`, stores and conversion code. Its adapter
accepts only note ids `-901` and `-902` and persists them in a separate IndexedDB
database named `noteme-notes-preview`. It never mounts `App`, initializes native
stores, opens SQLite, reads settings or polls the clipboard. The production data
directory is neither opened nor inspected. Do not import the bootstrap again to
inspect state; use the fixture's already-loaded typed API and queue instead.

**Close tab** uses the real tab store and editor cleanup. **Simulate window close**
uses the same close handler as the native guard and closes only after successful
saves. Reopen controls and browser reload verify fixture persistence. These are
browser/IndexedDB checks, not a native Tauri or SQLite UI test.

## Validation

```bash
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
git diff --check
```

The focused suites are `tests/note-richtext.test.cjs`, `tests/note-saves.test.cjs`
and `tests/note-store.test.cjs`. They use generated HTML, synthetic Markdown,
mock API writers and independent queues. They never open the user's database.

Browser checks should cover real typing with Enter/Shift+Enter, multiple blank
rows, repeated spaces, trailing empty rows, rich/Markdown/split/preview changes,
immediate tab close/reopen, note switching with delayed saves, close/reload,
storage failure and retry. Compare exact persisted fixture strings and measured
line heights before and after reopen. Merely entering/leaving rich text should
perform no writes. Verify both themes without reading real notes.

Rebuild the desktop application before testing the new native Quit/close wiring.
Do not claim native runtime validation from the browser fixture or Rust unit tests.

Validated November 22, 2026 with 250 Node tests, 12 Rust tests, the production web
build, formatting/diff checks and `npm run tauri build -- --bundles app`. Version
0.2.1 remains unchanged. The desktop bundle was built but neither installed nor
launched; no native user database or clipboard was accessed for this work.

Isolated browser checks verified exact mock strings after immediate tab closure,
window-close simulation and reload, mode changes, delayed saves across two notes,
storage failure/retry and typing into existing empty rows. Five authored rows
measured 122.5 px before and after reopen/reload. One, two and three trailing empty
rows kept matching 49, 73.5 and 98 px heights. Untouched rich-mode focus/blur and
mode switches performed zero writes. These measurements used the fixture's 14 px
font and 1.75 line height, not arbitrary user note data.
