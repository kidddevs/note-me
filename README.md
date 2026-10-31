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

### Books Studio

Books Studio is a second workspace in the same app, switched from the titlebar book icon or **View > Books Studio**. Notes remains the default workspace; switching does not mix manuscript data with note tabs or note navigation.

- Dedicated manuscript library, shelf, section rail, outline, settings, and export screens.
- Restores the last open manuscript and Books sidebar state after relaunch; each manuscript remembers its own last active section when you switch between books.
- First-class books and chapters stored in SQLite, separate from the notes tables.
- Distraction-reduced writing surface with H1-H6 Markdown formatting, preview mode, focus mode, section statistics, keyboard save, list continuation, and local auto-save.
- Find and replace inside a section, plus optional timed writing sprints that track the words written during each session.
- Auto-saved reader metadata for title, subtitle, author, genre, description, draft status, cover color, and a configurable word goal.
- Structured manuscript sections with typed title pages, prologues, chapters, interludes, appendices, front matter, and back matter. Add and classify sections from the left rail or their trackpad context menu.
- Optional dedication, epigraph, copyright, and acknowledgements pages are editable from the outline and included in exports.
- Custom trim sizes: 5 x 8, 5.25 x 8, 6 x 9, A5, A4, and US Letter.
- Paragraph style presets with character, paragraph, indent, spacing, tab, rule, border, shading, hyphenation, justification, drop cap, nested opening, GREP, bullet, numbering, color, underline, strikethrough, column, and role formatting controls. Presets are stored with the book layout, can be created, renamed, duplicated, deleted, and applied to any text box; edits to a preset update every text box using it.
- Custom role typography for titles, H1-H6 headings, paragraphs, and quotes, including font stacks, size, weight, italic, alignment, line height, and letter spacing. Page-level font size, line height, paragraph spacing, and margins remain available in Book settings.
- Artwork drawer for local images plus categorized, searchable, recolorable built-in SVG ornaments, dividers, botanical marks, symbols, geometric devices, borders, frames, lines, shapes, and arrows. Artwork can be dragged from the drawer onto the page or selected and reshaped with crop presets, fit modes, frames, corner treatments, captions, alignment, width, and direct replacement. Images can also be pasted or dropped directly into the manuscript; inserted artwork is embedded in the manuscript Markdown for portable exports.
- InDesign-style design canvas with Flow and Free layout modes. Flow keeps text in document order; Free turns the safe content area into an artboard where text boxes, artwork, tables, charts, and callouts can be positioned freely in X and Y, resized from either edge, snapped to margins, layered front/back, and reordered. Pointer direct manipulation, an eight-handle transform box with vertical frame resizing, live position/size badges, alignment guides that snap to page edges and sibling objects, zero-height insertion previews, zoom, rulers, guides, and fit-to-width make the page feel like a desktop publishing surface. The canvas itself stays free of floating control rails; selected-object controls live in the right rail.
- Page appearance settings separate the paper background (default white) and document accent color from the cover color. The editor chrome follows the app appearance accent, while page typography and document accents remain part of the book design. The manuscript breadcrumb bar is gone; its status and settings controls now live in the chapter bar, and canvas tools and page controls share one compact toolbar.
- Redesigned contextual design inspector for the selected object. Text boxes expose paragraph style presets, character controls, paragraph rhythm, hyphenation, columns, tabs, drop caps, nested openings, paragraph rules, border, shading, bullets, numbering, and GREP styling. Artwork exposes crop shape, fit, width, height, free position, corner radius, border, shadow, opacity, rotation, caption, alt text, alignment, and replacement. Tables, charts, and callouts keep their data and presentation controls in the same inspector, and empty selections reveal document-wide styles and role typography.
- Page-style canvas with trim-size rulers, per-edge page margins, margin guides, zoom controls, a fit-to-width action, and a freeform page surface. Enter creates a new paragraph on the canvas (Shift+Enter adds a line break), selected text boxes auto-grow, and inline character formatting covers bold, italic, underline, strikethrough, links, quotes, lists, and scene breaks. Source and Preview modes have been removed; Export Studio remains the place to inspect final reader output.
- Outline workbench with manuscript statistics, reading time, section word-weight bars, drag-to-reorder manuscript order, hidden and empty section health checks, and a curated generated-contents preview.
- Section-level undo and redo with grouped typing history, plus local version checkpoints captured automatically while writing, on manual save, and before every restore. Checkpoints can be previewed, restored, or deleted from the editor.
- Portable rich data blocks for GFM tables, configurable tables, bar / line / area / donut / stat charts, callouts, and graph fences. The contextual inspector exposes only the controls for the selected title, text, image, table, chart, or callout.
- Running headers and footers with left, center, and right slots. Use `{{title}}`, `{{author}}`, `{{section}}`, and `{{page}}` tokens.
- Flexible page numbering with automatic sequences or manual section range starts, Arabic or Roman styles, custom formats, configurable placement and starting section, plus per-section style overrides.
- Generated contents with configurable title, H1-H6 depth, legacy matter inclusion, per-section visibility, and individual heading visibility controls.
- Export to EPUB 3, DOCX, styled HTML, Markdown, and plain text. Print / Save as PDF uses the selected trim size and page styling.
- Export preview includes separate cover and interior views plus an actionable preflight for reader metadata, empty sections, contents, repeated titles, page numbering, and embedded artwork.
- Browser-style book tabs with a Library home tab, drag-to-reorder, middle-click close, relative navigation, and the same titlebar controls as the Notes workspace.
- Keyboard-complete tabs, command search, section menus, and accessible in-app confirmation dialogs keep manuscript navigation and destructive actions inside the Studio workflow.

## Install

### macOS

Download the latest Apple Silicon DMG from the [GitHub Releases](https://github.com/kidddevs/note-me/releases) page, open it, and drag NoteMe into Applications.

The Apple Silicon release artifact is built as `NoteMe_0.1.1_aarch64.dmg`. Intel and other platform installers can be produced from source with the Tauri build command below.

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
| `Cmd+N` | Create a note, or a book while Books Studio is active |
| `Cmd+T` | Open a new tab: all notes, or the Books library |
| `Cmd+W` | Close the active tab |
| `Cmd+Shift+D` | Duplicate the active note |
| `Cmd+K` / `Cmd+Shift+P` | Open the command palette |
| `Cmd+Shift+N` | Open global Quick Capture |
| `Cmd+Shift+V` | Toggle Clipboard History |
| `Cmd+,` | Open Preferences |
| `Cmd+Ctrl+S` | Toggle the sidebar |
| `Cmd+Shift+T` | Toggle appearance |
| `Cmd+Shift+]` / `Cmd+Shift+[` | Next / previous tab |
| `Cmd+F` | Find in the current Books Studio section |
| `Cmd+Alt+F` | Find and replace in a Books Studio section |
| `Cmd+Alt+0`–`Cmd+Alt+3` | Apply Body, H1, H2, or H3 to the selected text box |
| `Cmd+Alt+Q` | Apply quote style to the selected text box |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / redo manuscript edits |
| `Cmd+P` | Print the current note |
| `Cmd+B` / `Cmd+I` / `Cmd+U` | Bold / italic / underline in rich text and canvas text |
| `Cmd+Shift+X` | Strikethrough in canvas text |

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
  components/            TitleBar, Sidebar, Editor, Books Studio, views, panels
  lib/                   Tauri API wrappers, actions, formatting, rich text
  store/                 Notes, books, tabs, workspace, theme, and toast state
  styles.css             Application design system and responsive layout
src-tauri/               Rust desktop shell and persistence layer
  src/lib.rs             Window creation, macOS menu, and global shortcuts
  src/commands.rs        Note, book, chapter, category, tag, task, clipboard, and settings commands
  src/db.rs              SQLite schema and initialization
  capabilities/          Tauri permissions
```

## Contributing

1. Fork the repository and create a focused branch.
2. Run `npm install` and `npm run tauri dev`.
3. Keep data local and preserve the Markdown data model.
4. Before opening a pull request, run `npm test` and `npm run build`. `npm test` covers TypeScript, publishing utilities, SQLite migrations, and Rust command validation.

Bug reports and focused pull requests are welcome. Please do not include local databases, build output, screenshots, or machine-specific configuration in commits.

## License

NoteMe is released under the [MIT License](LICENSE).
