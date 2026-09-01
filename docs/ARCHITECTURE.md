# NoteMe Architecture

## Overview

NoteMe is a Tauri 2 desktop application. A Rust process owns the window, native integration (menus, global shortcuts, clipboard), and a local SQLite database. The UI is a React 18 + Vite webview that talks to Rust exclusively through typed `invoke` calls and `emit`/`listen` events.

```
┌────────────────────────── Webview (React) ──────────────────────────┐
│  TitleBar  Notes workspace / Books Studio  Palette ...              │
│  stores: tabs · notes · books · workspace · theme · toast             │
└──────┬──────────────────────────────┬───────────────────────────────┘
       │ invoke (typed commands)      │ events (emit/listen)
┌──────▼──────────────────────────────▼───────────────────────────────┐
│                           Rust (Tauri 2)                            │
│  commands.rs: notes + books      lib.rs: window, macOS menu,        │
│  db.rs: SQLite (WAL, bundled)     global shortcuts, plugins          │
└──────────────────────────────────────────────────────────────────────┘
```

## Data flow

- **Reads**: frontend calls `api.listNotes()` → `invoke("list_notes")` → SQL. The `useNotes` zustand store caches everything (`notes`, `archived`, `trashed`, `categories`, `tags`, `clipboard`, `stats`) and is the single source of truth for the UI.
- **Writes**: optimistic UI state → debounced `update_note` (700ms) → Rust emits `notes-changed` → store `refresh()` re-fetches.
- **Books writes**: `useBooks` keeps books and chapters separate from notes → typed `create/update_*` commands → SQLite. Chapter text is autosaved after 700ms and book settings after 900ms; dirty editor/settings state intercepts native window close long enough to finish the latest local write.
- **Events**: `notes-changed`, `clipboard-changed` (Rust → frontend), `global-shortcut` (`quick-capture` / `toggle-clipboard`), `menu` (native menu item ids), and `open-files` for associated Markdown/text files.

## Windows

The main window is created in Rust (`lib.rs` → `setup`) so it can be platform-specific:

- **macOS**: `decorations: true` + `TitleBarStyle::Overlay` + `hidden_title` + traffic lights at `(16, 24)` → native buttons/corners/shadows; the webview draws a 44px titlebar and begins its controls at 80px so the native controls and web controls share a 22px centerline.
- **Windows/Linux**: `decorations: false` → fully custom titlebar with min/max/close rendered in React, drag via `data-tauri-drag-region`, double-click to maximize.

Default size 420×520 (note-taker feel, auto-hides sidebar below 860px via CSS media query); `tauri-plugin-window-state` persists size/position afterwards. `tauri-plugin-single-instance` focuses the existing window on relaunch.

## macOS native menu

Built in `setup_macos_menu` with `tauri::menu`:

- App menu: About / Services / Hide / Quit (predefined roles).
- File: New Note (⌘N), New Tab (⌘T), Close Tab (⌘W), Close Window, Export All Notes….
- Edit: undo/redo/cut/copy/paste/select-all (predefined — these keep clipboard shortcuts working in the webview).
- View: Command Palette (⌘⇧P), Quick Capture, Clipboard History, Toggle Sidebar (⌘⌃S), Toggle Appearance (⌘⇧T), Notes, Books Studio, Fullscreen.
- Window: Next/Previous Tab, Minimize, Zoom.

Custom items emit `"menu"` events (or `"global-shortcut"` for capture/clipboard) handled in `App.tsx`. Global shortcuts (`⌘⇧N`, `⌘⇧V`) are registered with `tauri-plugin-global-shortcut` and work system-wide.

## Editing pipeline

- **Markdown modes** (`edit`/`split`/`preview`): a plain `<textarea>` + `react-markdown` + `remark-gfm` preview. Toolbar helpers mutate the textarea via selection-aware insert/wrap.
- **Rich text mode**: a `contenteditable` div (`RichTextEditor.tsx`). On mount it renders `markdownToHtml()` (react-markdown → `renderToStaticMarkup`); every input is converted back with `turndown` (custom rules: GFM task lists, checkbox stripping) into the same markdown state, so the note stays markdown-on-disk no matter which editor you used.
- Keyboard shortcuts run only in the active mode; `execCommand` (legacy but universally supported in WKWebView/WebView2/WebKitGTK) powers rich text formatting.

## Database schema

```sql
settings(key TEXT PRIMARY KEY, value TEXT)
categories(id, name, color, icon, sort_order, created_at)
notes(id, title, content, category_id →categories, pinned, favorite,
      archived, trashed, trashed_at, created_at, updated_at)
tags(id, name UNIQUE, color)
note_tags(note_id →notes, tag_id →tags, PK(note_id, tag_id))
clipboard_items(id, kind, content, created_at)
books(id, title, subtitle, author, description, genre, status, trim_size,
      font_family, font_size, line_height, paragraph_spacing, margin,
       word_goal, cover_color, dedication, epigraph, copyright_text,
       acknowledgements, toc_enabled, toc_title, toc_depth,
       toc_include_front_matter, toc_include_back_matter, layout_json,
       created_at, updated_at)
book_chapters(id, book_id →books, chapter_kind, title, content, position,
              toc_include, toc_heading_exclusions, created_at, updated_at)
```

WAL mode, `foreign_keys = ON`. Trash is a soft delete (`trashed = 1`); `empty_trash` / `delete_note_forever` are the only hard deletes. On startup `purge_old_trash` hard-deletes notes trashed more than 30 days ago. Snippets are computed in Rust (`fill_tags` strips whitespace).

## Tasks aggregation

`list_tasks` scans every non-trashed, non-archived note's content line-by-line for GFM task markers (`- [ ] ` / `- [x] `, `*` bullets too) and returns flat `TaskItem`s (`note_id`, `line_index`, `text`, `done`). The Tasks view groups them by note; toggling a checkbox splices the exact line in the source note's markdown and saves through the normal pipeline.

## Attachments

Pasting/dropping an image calls `save_attachment(data, ext)` which writes `app_data/attachments/img-<nanos>.<ext>` and returns the absolute path. The frontend wraps it with `convertFileSrc()` and inserts standard `![image](...)` markdown, so notes stay portable plain-text. Rendering uses Tauri's asset protocol, enabled with the `protocol-asset` feature and scoped to `$APPDATA/attachments/**` in `tauri.conf.json`.

## Clipboard capture

The frontend polls `readText()` every 1.5s; on change it calls `save_clipboard_item`, which dedupes (latest copy wins) and caps history in UI (last 100). The panel is a right-side overlay (`ClipboardPanel`), toggleable from anywhere via the global shortcut.

## Workspace architecture

NoteMe is a two-workspace application in one native window. `useWorkspace` persists the selected top-level mode through the existing `settings` table, defaulting to `notes` when no preference exists. The titlebar switcher and macOS View menu both change this mode.

The Notes workspace owns note tabs, the notes sidebar, Quick Capture, Clipboard History, and the command palette. The Books Studio workspace owns its own library, shelf, section rail, outline, settings, and export screens. Note tabs stay in memory while Books Studio is active, but the Books UI never routes manuscript actions through the note store. Workspace mode, the Books sidebar state, selected manuscript, and active section are persisted through the settings table; stale saved ids are discarded during initialization. Active sections use per-book setting keys, with the former global key retained as a migration fallback, so switching manuscripts returns each book to its own last writing position.

Books use first-class `books` and `book_chapters` tables instead of serialized settings or note categories. This keeps manuscript metadata, chapter order, and publishing controls independent from note organization. Chapter kinds preserve semantic structure for title pages, front matter, story sections, appendices, and back matter. Rust validates publishing ranges, enum-like fields, layout JSON, section kinds, and heading-exclusion payloads before writes; update/delete commands reject missing records instead of silently succeeding. The current export layer produces EPUB 3, DOCX, styled HTML, Markdown, and plain text; native print uses the same trim size and typography controls for PDF output.

Books Studio keeps its custom interaction surfaces keyboard-operable: tab groups implement roving focus and arrow navigation, command search exposes an active listbox option, popup menus support arrow/Home/End/Escape behavior, and destructive actions use focus-trapped `alertdialog` confirmations that restore focus to their trigger.

Binary EPUB/DOCX export requires `fs:allow-write-file`; text formats use `fs:allow-write-text-file`. The save dialog grants the chosen path to the runtime filesystem scope, while the static capability remains limited to `$HOME/**` for non-dialog writes.

## Books Studio editor

The manuscript editor stores section content as Markdown so it remains portable while exposing a long-form writing surface. The left section rail owns creation, selection, ordering, type changes, and per-section contents visibility; its trackpad context menu exposes the same actions. Formatting buttons support H1-H6, emphasis, links, quotes, lists, code, scene breaks, artwork insertion, and keyboard save. Built-in book graphics are recolorable SVG data URIs with category and variant filters; local images are read through the Tauri file picker, or pasted/dropped from the webview, and embedded as data URIs. Rich content uses Markdown-compatible GFM tables plus `:::table`, `:::chart`, `:::callout`, and `chart` / `graph` fenced blocks. Canvas mode parses those source ranges into editable text blocks and selectable visual blocks. Width and placement changes for text blocks use hidden `<!-- note-me:layout ... -->` comments that the renderer and plain-text exporter strip; image and rich-block presentation stays in their portable source attributes or JSON. `BooksInspector` derives its controls from the current editor selection, so typography, image presentation, table, chart, callout, text-box presentation, move, resize, and delete operations update the source without introducing a second document model. Contents entries are derived from persisted sections and Markdown headings, ignoring fenced code blocks; the outline can independently hide eligible headings per section. The resulting map is shared by the outline, export preview, print output, Markdown, HTML, EPUB, DOCX, and plain-text exporters. Book settings feed the writing canvas, print CSS, HTML export, EPUB chapter CSS, and DOCX page margins. Export preview intentionally offers both cover and interior views so layout changes can be inspected before writing a file. `bookExportChecks()` provides the tested, format-independent preflight used by Export Studio to surface missing metadata, empty story sections, contents gaps, repeated titles, and optional finishing suggestions with navigation back to the relevant editor.

`books.layout_json` stores publishing chrome and role typography independently from manuscript text. Its normalized shape contains three-slot running `header` and `footer` values, `pageNumbering` defaults with a keyed `rules` map for per-section number styles and starting ranges, and `typography` styles for the title, six heading levels, paragraph, and quote roles. Invalid or missing JSON falls back to the default layout, keeping older local databases readable after migration. Header/footer tokens resolve at render time; page-number fields are emitted for DOCX and resolved section labels are emitted for HTML, EPUB, preview, and native print. HTML, EPUB, print, and DOCX consume the resolved role styles; Markdown and plain text preserve the source representation.

Publishing utility regressions run through Node's built-in test runner after a small CommonJS test compilation (`tsconfig.tests.json`). Rust unit tests cover legacy SQLite book-table migration and the write-validation boundary. `npm test` runs both layers after the main TypeScript check.

## Conventions

- Flat design only — no gradients. Surfaces: `--bg / --surface / --surface-2 / --surface-3`, 1px borders, subtle shadows, 6–14px radii.
- Lucide icons only; 15px default in controls, 12–13px in dense rows.
- System font stack (`-apple-system, …`) with `-webkit-font-smoothing: antialiased`.
- Theme tokens are CSS custom properties switched via `data-theme` on `<html>`; system default.
- `prefers-reduced-motion` globally disables animations.
