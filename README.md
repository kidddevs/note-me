# NoteMe

> A fast, private notes workspace for people who want their thinking close at hand and their data under their control.

NoteMe is an open-source, local-first desktop notes app for macOS, Windows, and Linux. It combines a calm writing surface with browser-style tabs, Markdown and rich text, quick capture, task views, clipboard history, and a native desktop shell.

There is no account, cloud dependency, tracking, or required sync service. Notes are stored in a local SQLite database and stay on your machine.

## Why NoteMe

- **Private by default:** local storage, no telemetry, and no server account.
- **Fast to open:** a focused note-taker window with a keyboard-first workflow.
- **Built for depth:** Markdown, rich text, attachments, tasks, tags, categories, and search in one workspace.
- **At home on your OS:** native macOS traffic lights and menus, persistent window state, global quick capture, and platform-aware window controls.
- **Small surface area:** your notes remain usable as plain Markdown instead of being trapped in a proprietary format.

## Features

### Writing

- Markdown write, split, and preview modes.
- Rich text editing with headings, emphasis, underline, lists, task lists, quotes, code blocks, and links.
- Lossless Markdown conversion when switching between editing modes.
- Debounced auto-save, automatic titles, word count, character count, and reading time.
- Paste or drag images into notes; attachments are stored locally.

### Organization

- Browser-style tabs with drag-to-reorder, middle-click close, and relative tab navigation.
- All Notes, Favorites, Tasks, Archive, and Trash views.
- Color-coded categories and tags with live counts.
- Full-text search and command palette navigation.
- Pin, favorite, archive, restore, permanently delete, duplicate, and batch-manage notes.

### Desktop workflow

- Native macOS application menu with About NoteMe and release update checking.
- Global Quick Capture with `Cmd+Shift+N` and `Cmd+Enter` to save.
- Clipboard history with `Cmd+Shift+V` and one-click note creation.
- Daily Note, Meeting, and Journal templates.
- System, Light, and Dark themes with persisted preferences.
- Import `.md`, `.markdown`, and `.txt` files by dropping them into the app.
- Print and PDF export through the native print flow.

## Install

### macOS

Download the latest Apple Silicon DMG from the [GitHub Releases](https://github.com/kidddevs/note-me/releases) page, open it, and drag NoteMe into Applications.

The first public artifact is built for Apple Silicon as `NoteMe_0.1.0_aarch64.dmg`. Intel and other platform installers can be produced from source with the Tauri build command below.

To check for a newer release inside the app, use **NoteMe > Check for Updates...**. NoteMe only shows a download action when the GitHub release is newer than the installed version.

### Build from source

Requirements:

- Node.js 20 or newer
- Rust stable and Cargo
- Platform prerequisites listed in the [Tauri v2 prerequisites guide](https://v2.tauri.app/start/prerequisites/)

```bash
npm install
npm run tauri dev
```

Create installers:

```bash
npm run build
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/`.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+N` | Create a note |
| `Cmd+T` | Open a new tab / browse all notes |
| `Cmd+W` | Close the active tab |
| `Cmd+Shift+D` | Duplicate the active note |
| `Cmd+K` / `Cmd+Shift+P` | Open the command palette |
| `Cmd+Shift+N` | Open global Quick Capture |
| `Cmd+Shift+V` | Toggle Clipboard History |
| `Cmd+,` | Open Preferences |
| `Cmd+Ctrl+S` | Toggle the sidebar |
| `Cmd+Shift+T` | Toggle appearance |
| `Cmd+Shift+]` / `Cmd+Shift+[` | Next / previous tab |
| `Cmd+F` | Find and replace in Markdown mode |
| `Cmd+P` | Print the current note |
| `Cmd+B` / `Cmd+I` / `Cmd+U` | Bold / italic / underline in rich text |
| `Cmd+1` / `Cmd+2` | Apply heading 1 / heading 2 in Markdown mode |

## Data and privacy

NoteMe uses SQLite with WAL journaling. On macOS, the database lives at:

```text
~/Library/Application Support/com.dakid.noteme/
```

The app does not upload notes or attachments. The only network request made by the update checker is to the public GitHub Releases API when you explicitly choose **Check for Updates...**.

## Technology

- Tauri 2 and Rust for the desktop shell
- React 18, TypeScript, and Vite for the interface
- SQLite via `rusqlite` for durable local storage
- Zustand for application state
- `react-markdown`, `remark-gfm`, and `turndown` for Markdown and rich text

The codebase is intentionally split between a small React UI layer and explicit Rust commands for persistence and OS integration. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data flow and command boundary.

## Project map

```text
src/                     React application
  components/            TitleBar, Sidebar, Editor, views, modals, panels
  lib/                   Tauri API wrappers, actions, formatting, rich text
  store/                 Notes, tabs, theme, and toast state
  styles.css             Application design system and responsive layout
src-tauri/               Rust desktop shell and persistence layer
  src/lib.rs             Window creation, macOS menu, and global shortcuts
  src/commands.rs        Note, category, tag, task, clipboard, and settings commands
  src/db.rs              SQLite schema and initialization
  capabilities/          Tauri permissions
```

## Contributing

1. Fork the repository and create a focused branch.
2. Run `npm install` and `npm run tauri dev`.
3. Keep data local and preserve the Markdown data model.
4. Before opening a pull request, run `npm run build` and `cargo check --manifest-path src-tauri/Cargo.toml`.

Bug reports and focused pull requests are welcome. Please do not include local databases, build output, screenshots, or machine-specific configuration in commits.

## License

NoteMe is released under the [MIT License](LICENSE).
