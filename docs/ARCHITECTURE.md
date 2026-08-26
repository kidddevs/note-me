# NoteMe Architecture

## Overview

NoteMe is a Tauri 2 desktop application. A Rust process owns the window, native integration (menus, global shortcuts, clipboard), and a local SQLite database. The UI is a React 18 + Vite webview that talks to Rust exclusively through typed `invoke` calls and `emit`/`listen` events.

```
┌────────────────────────── Webview (React) ──────────────────────────┐
│  TitleBar(tabs)  Sidebar  Editor(+RichText)  ViewTab  Palette ...   │
│  stores: tabs · notes · theme · toast                                │
└──────┬──────────────────────────────┬───────────────────────────────┘
       │ invoke (typed commands)      │ events (emit/listen)
┌──────▼──────────────────────────────▼───────────────────────────────┐
│                           Rust (Tauri 2)                            │
│  commands.rs: ~40 commands      lib.rs: window, macOS menu,         │
│  db.rs: SQLite (WAL, bundled)     global shortcuts, plugins          │
└──────────────────────────────────────────────────────────────────────┘
```

## Data flow

- **Reads**: frontend calls `api.listNotes()` → `invoke("list_notes")` → SQL. The `useNotes` zustand store caches everything (`notes`, `archived`, `trashed`, `categories`, `tags`, `clipboard`, `stats`) and is the single source of truth for the UI.
- **Writes**: optimistic UI state → debounced `update_note` (700ms) → Rust emits `notes-changed` → store `refresh()` re-fetches.
- **Events**: `notes-changed`, `clipboard-changed` (Rust → frontend), `global-shortcut` (`quick-capture` / `toggle-clipboard`), `menu` (native menu item ids).

## Windows

The main window is created in Rust (`lib.rs` → `setup`) so it can be platform-specific:

- **macOS**: `decorations: true` + `TitleBarStyle::Overlay` + `hidden_title` + traffic lights at `(16, 15)` → native buttons/corners/shadows; the webview draws the custom 42px titlebar beneath them (78px left padding clears the lights).
- **Windows/Linux**: `decorations: false` → fully custom titlebar with min/max/close rendered in React, drag via `data-tauri-drag-region`, double-click to maximize.

Default size 420×520 (note-taker feel, auto-hides sidebar below 860px via CSS media query); `tauri-plugin-window-state` persists size/position afterwards. `tauri-plugin-single-instance` focuses the existing window on relaunch.

## macOS native menu

Built in `setup_macos_menu` with `tauri::menu`:

- App menu: About / Services / Hide / Quit (predefined roles).
- File: New Note (⌘N), New Tab (⌘T), Close Tab (⌘W), Close Window, Export All Notes….
- Edit: undo/redo/cut/copy/paste/select-all (predefined — these keep clipboard shortcuts working in the webview).
- View: Command Palette (⌘⇧P), Quick Capture, Clipboard History, Toggle Sidebar (⌘⌃S), Toggle Appearance (⌘⇧T), Fullscreen.
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
```

WAL mode, `foreign_keys = ON`. Trash is a soft delete (`trashed = 1`); `empty_trash` / `delete_note_forever` are the only hard deletes. On startup `purge_old_trash` hard-deletes notes trashed more than 30 days ago. Snippets are computed in Rust (`fill_tags` strips whitespace).

## Tasks aggregation

`list_tasks` scans every non-trashed, non-archived note's content line-by-line for GFM task markers (`- [ ] ` / `- [x] `, `*` bullets too) and returns flat `TaskItem`s (`note_id`, `line_index`, `text`, `done`). The Tasks view groups them by note; toggling a checkbox splices the exact line in the source note's markdown and saves through the normal pipeline.

## Attachments

Pasting/dropping an image calls `save_attachment(data, ext)` which writes `app_data/attachments/img-<nanos>.<ext>` and returns the absolute path. The frontend wraps it with `convertFileSrc()` and inserts standard `![image](...)` markdown, so notes stay portable plain-text. Rendering uses Tauri's asset protocol, enabled with the `protocol-asset` feature and scoped to `$APPDATA/attachments/**` in `tauri.conf.json`.

## Clipboard capture

The frontend polls `readText()` every 1.5s; on change it calls `save_clipboard_item`, which dedupes (latest copy wins) and caps history in UI (last 100). The panel is a right-side overlay (`ClipboardPanel`), toggleable from anywhere via the global shortcut.

## Conventions

- Flat design only — no gradients. Surfaces: `--bg / --surface / --surface-2 / --surface-3`, 1px borders, subtle shadows, 6–14px radii.
- Lucide icons only; 15px default in controls, 12–13px in dense rows.
- System font stack (`-apple-system, …`) with `-webkit-font-smoothing: antialiased`.
- Theme tokens are CSS custom properties switched via `data-theme` on `<html>`; system default.
- `prefers-reduced-motion` globally disables animations.
