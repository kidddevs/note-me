# NoteMe

A local-first, cross-platform notes app for **macOS, Windows & Linux** — built to beat Apple Notes on UX and features, while keeping every byte of data on your device.

**Stack:** Tauri 2 (Rust shell) · React 18 · Vite · TypeScript · SQLite (rusqlite, bundled) · zustand · lucide-react · react-markdown · turndown

> Everything runs locally. There is no cloud, no account, no telemetry. Your notes live in a SQLite database in your OS app-data folder.

## Quick start

```bash
npm install
npm run tauri dev     # development
npm run tauri build   # release installers (src-tauri/target/release/bundle/)
```

## Native platform behavior

- **macOS** — real native traffic lights (Overlay title bar), native menu bar (NoteMe / File / Edit / View / Window with correct roles), window-state persistence, single-instance (second launch focuses the running app), dock-click reopen, native fullscreen / minimize / zoom.
- **Windows / Linux** — custom frameless titlebar with native-style min/max/close controls, double-click the titlebar to maximize.

## Editing

- **Markdown** — write / split / preview modes with a formatting toolbar and ⌘ shortcuts.
- **Rich text** — WYSIWYG mode (`⌘`-free toolbar: headings, bold, italic, underline, strikethrough, lists, task lists, quotes, code blocks, links). Converts to and from Markdown losslessly via turndown, so you can switch modes per note.
- Auto-save (debounced 700ms) with `Saving…` indicator, auto-title from the first line, word/char count, reading time.

## Features

| Feature | Details |
| --- | --- |
| **Browser-style tabs** | Open notes in multiple tabs, drag to reorder, middle-click to close, `⌘T` new tab, `⌘W` close, `⌘⇧]` / `⌘⇧[` next/prev, `⌘N` new note, ⌘/middle-click a card to force a new tab |
| **Smart sidebar** | All Notes, Favorites, Archive, Trash, color-coded categories (custom icon + color) and tags, live counts, full-text search, collapsible (`⌘⌃S`) |
| **Clipboard manager** | Background clipboard history, `⌘⇧V` toggles the panel globally, click to re-copy, one-click "new note from clipboard" |
| **Quick capture** | Global `⌘⇧N` (works when NoteMe is unfocused), `⌘↵` to save |
| **Command palette** | `⌘K` / `⌘⇧P` to search notes and jump anywhere |
| **Themes** | System / Light / Dark, system default, persisted |
| **Notifications** | In-app toast system: success / info / warning / error |
| **Storage** | SQLite, WAL mode, at the OS app-data dir (`~/Library/Application Support/com.dakid.noteme/` on macOS) |
| **More** | Pin, favorite, archive, trash with restore, tags per note, categories, duplicate note (`⌘⇧D`), export single note as `.md`, **Export All Notes** to a folder, focus mode, small default window (420×520) that behaves like a note taker and auto-hides the sidebar at narrow widths |

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘N` | New note (opens in a tab) |
| `⌘T` | New tab |
| `⌘W` | Close tab |
| `⌘⇧D` | Duplicate note |
| `⌘K` / `⌘⇧P` | Command palette |
| `⌘⇧N` | Quick capture (global) |
| `⌘⇧V` | Toggle clipboard panel (global) |
| `⌘,` | Settings |
| `⌘⌃S` | Toggle sidebar |
| `⌘⇧T` | Toggle appearance |
| `⌘⇧]` / `⌘⇧[` | Next / previous tab |
| `⌘B` / `⌘I` / `⌘U` | Bold / italic / underline (rich text) |
| `⌘1` / `⌘2` | Heading 1 / 2 (markdown) |

## Project structure

```
src/                     React frontend
  components/            TitleBar (tabs), Sidebar, Editor (+RichTextEditor),
                         ViewTab, NoteList, ClipboardPanel, QuickCapture,
                         Palette, Toasts, Modals, RichTextEditor
  lib/                   api (Tauri invoke wrappers), types, format utils, richtext (MD<->HTML)
  store/                 zustand: tabs, notes, theme (UI prefs), toast
  styles.css             design tokens (flat, no gradients) + all styles
src-tauri/               Rust backend
  src/lib.rs             window creation (platform-aware), macOS menu, global shortcuts
  src/commands.rs        ~40 Tauri commands (notes, categories, tags, clipboard, settings)
  src/db.rs              SQLite schema + init
  src/models.rs          serde models
  capabilities/          Tauri permissions
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for deeper details.

## Database

`notes`, `categories`, `tags`, `note_tags`, `clipboard_items`, `settings` — foreign keys on, WAL journaling. Notes are soft-deleted into Trash (`trashed` flag) before permanent deletion.
