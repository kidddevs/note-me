import {
  CheckCircle2,
  FilePlus2,
  Folder,
  Pin,
  PinOff,
  SearchX,
  Star,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Note } from "../lib/types";
import { openNoteInTab, useNotes } from "../store/notes";
import { useTabs } from "../store/tabs";
import { excerpt, formatRelative } from "../lib/format";
import { copyText, duplicateNote, exportNoteMarkdown } from "../lib/actions";
import { playTrashSound } from "../lib/sounds";
import { notify } from "../store/toast";

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const terms = query.trim().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return text;
  const re = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  return text
    .split(re)
    .map((part, i) =>
      re.test(part) ? <mark key={i}>{part}</mark> : part
    );
}

interface CardMenu {
  x: number;
  y: number;
  note: Note;
}

function NoteCard({
  note,
  searchQuery,
  isSelected,
  onToggleSelect,
  onMenu,
}: {
  note: Note;
  searchQuery: string;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onMenu: (m: CardMenu) => void;
}) {
  const togglePin = useNotes((s) => s.togglePin);
  const deleteNote = useNotes((s) => s.deleteNote);

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      onToggleSelect(note.id);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      useTabs
        .getState()
        .openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
    } else {
      openNoteInTab(note);
    }
  };

  return (
    <div
      className={`note-card ${note.pinned ? "pinned-card" : ""} ${
        isSelected ? "selected-card" : ""
      }`}
      style={{
        outline: isSelected ? "2px solid var(--accent)" : undefined,
        outlineOffset: isSelected ? 1 : undefined,
      }}
      onClick={handleClick}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          useTabs
            .getState()
            .openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ x: e.clientX, y: e.clientY, note });
      }}
      title="Open · ⇧-click to select · ⌘-click for new tab"
    >
      <div className="card-actions">
        <button
          className={`icon-btn ${note.favorite ? "active" : ""}`}
          title={note.favorite ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation();
            useNotes.getState().toggleFavorite(note.id);
          }}
        >
          <Star size={12} color={note.favorite ? "var(--warning)" : "currentColor"} />
        </button>
        <button
          className={`icon-btn ${note.pinned ? "active" : ""}`}
          title={note.pinned ? "Unpin" : "Pin"}
          onClick={(e) => {
            e.stopPropagation();
            togglePin(note.id);
          }}
        >
          {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          className="icon-btn danger"
          title="Move to Trash"
          onClick={(e) => {
            e.stopPropagation();
            playTrashSound();
            deleteNote(note.id);
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="card-title">
        {note.pinned && <Pin size={12} color="var(--accent)" style={{ flexShrink: 0 }} />}
        {note.favorite && <Star size={12} color="var(--warning)" style={{ flexShrink: 0 }} />}
        <span>{highlight(note.title || "Untitled", searchQuery)}</span>
      </div>
      <div className="card-excerpt">
        {highlight(excerpt(note.content) || "No additional text", searchQuery)}
      </div>
      <div className="card-tags">
        {note.tags.slice(0, 3).map((t) => (
          <span
            key={t.id}
            className="tag-chip"
            style={{ color: t.color, background: `${t.color}18` }}
          >
            {t.name}
          </span>
        ))}
      </div>
      <div className="card-meta">
        {note.category_name && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              className="category-dot"
              style={{
                width: 7,
                height: 7,
                background: note.category_color ?? "var(--border-strong)",
              }}
            />
            {note.category_name}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  );
}

function NoteCompactRow({
  note,
  searchQuery,
  isSelected,
  onToggleSelect,
  onMenu,
}: {
  note: Note;
  searchQuery: string;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onMenu: (m: CardMenu) => void;
}) {
  const togglePin = useNotes((s) => s.togglePin);
  const deleteNote = useNotes((s) => s.deleteNote);

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      onToggleSelect(note.id);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      useTabs
        .getState()
        .openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
    } else {
      openNoteInTab(note);
    }
  };

  return (
    <div
      className={`compact-row ${note.pinned ? "pinned-card" : ""}`}
      style={{
        outline: isSelected ? "2px solid var(--accent)" : undefined,
        outlineOffset: isSelected ? 1 : undefined,
      }}
      onClick={handleClick}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          useTabs
            .getState()
            .openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ x: e.clientX, y: e.clientY, note });
      }}
      title="Open · ⇧-click to select · ⌘-click for new tab"
    >
      <div className="card-actions">
        <button
          className={`icon-btn ${note.favorite ? "active" : ""}`}
          title={note.favorite ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation();
            useNotes.getState().toggleFavorite(note.id);
          }}
        >
          <Star size={12} color={note.favorite ? "var(--warning)" : "currentColor"} />
        </button>
        <button
          className={`icon-btn ${note.pinned ? "active" : ""}`}
          title={note.pinned ? "Unpin" : "Pin"}
          onClick={(e) => {
            e.stopPropagation();
            togglePin(note.id);
          }}
        >
          {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          className="icon-btn danger"
          title="Move to Trash"
          onClick={(e) => {
            e.stopPropagation();
            playTrashSound();
            deleteNote(note.id);
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="compact-title-wrap">
        <div className="compact-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {note.pinned && <Pin size={11} color="var(--accent)" style={{ flexShrink: 0 }} />}
          {note.favorite && <Star size={11} color="var(--warning)" style={{ flexShrink: 0 }} />}
          <span>{highlight(note.title || "Untitled", searchQuery)}</span>
        </div>
        <div className="compact-preview">
          {highlight(excerpt(note.content, 90) || "No additional text", searchQuery)}
        </div>
      </div>

      <div className="compact-meta">
        {note.category_name && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              className="category-dot"
              style={{
                width: 7,
                height: 7,
                background: note.category_color ?? "var(--border-strong)",
              }}
            />
            {note.category_name}
          </span>
        )}
        <span>{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  );
}

export function NoteList({
  notes,
  emptyTitle,
  emptyMessage,
  onEmptyAction,
  layout = "grid",
}: {
  notes: Note[];
  emptyTitle: string;
  emptyMessage: string;
  onEmptyAction?: () => void;
  layout?: "grid" | "list";
}) {
  const searchQuery = useNotes((s) => s.searchQuery);
  const categories = useNotes((s) => s.categories);
  const [menu, setMenu] = useState<CardMenu | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchCategoryOpen, setBatchCategoryOpen] = useState(false);

  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const rest = useMemo(() => notes.filter((n) => !n.pinned), [notes]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(notes.map((n) => n.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Batch Operations
  const batchPin = async () => {
    const list = [...selectedIds];
    for (const id of list) {
      await useNotes.getState().togglePin(id);
    }
    notify("success", `Updated pin state for ${list.length} notes`);
    clearSelection();
  };

  const batchFavorite = async () => {
    const list = [...selectedIds];
    for (const id of list) {
      await useNotes.getState().toggleFavorite(id);
    }
    notify("success", `Updated favorites for ${list.length} notes`);
    clearSelection();
  };

  const batchTrash = async () => {
    const list = [...selectedIds];
    if (window.confirm(`Move ${list.length} notes to trash?`)) {
      playTrashSound();
      for (const id of list) {
        await useNotes.getState().deleteNote(id);
      }
      notify("info", `Moved ${list.length} notes to trash`);
      clearSelection();
    }
  };

  const batchSetCategory = async (categoryId: number | null) => {
    const list = [...selectedIds];
    for (const id of list) {
      await useNotes.getState().setCategory(id, categoryId);
    }
    notify("success", `Moved ${list.length} notes to category`);
    setBatchCategoryOpen(false);
    clearSelection();
  };

  if (notes.length === 0) {
    return (
      <div className="notes-grid" onClick={() => setMenu(null)}>
        <div className="empty-state">
          <div className="empty-icon">
            <SearchX size={24} />
          </div>
          <h3>{emptyTitle}</h3>
          <p>{emptyMessage}</p>
          {onEmptyAction && (
            <button className="btn primary" onClick={onEmptyAction}>
              <FilePlus2 size={14} /> New Note
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}
      onClick={() => setMenu(null)}
    >
      <div className={layout === "list" ? "notes-compact-list" : "notes-grid"}>
        {pinned.length > 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-3)",
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "4px 2px 2px",
            }}
          >
            <Pin size={12} color="var(--accent)" /> Pinned · {pinned.length}
          </div>
        )}
        {pinned.map((n) =>
          layout === "list" ? (
            <NoteCompactRow
              key={n.id}
              note={n}
              searchQuery={searchQuery}
              isSelected={selectedIds.has(n.id)}
              onToggleSelect={toggleSelect}
              onMenu={setMenu}
            />
          ) : (
            <NoteCard
              key={n.id}
              note={n}
              searchQuery={searchQuery}
              isSelected={selectedIds.has(n.id)}
              onToggleSelect={toggleSelect}
              onMenu={setMenu}
            />
          )
        )}
        {rest.length > 0 && pinned.length > 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-3)",
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "12px 2px 2px",
            }}
          >
            <StickyNote size={12} /> Notes · {rest.length}
          </div>
        )}
        {rest.map((n) =>
          layout === "list" ? (
            <NoteCompactRow
              key={n.id}
              note={n}
              searchQuery={searchQuery}
              isSelected={selectedIds.has(n.id)}
              onToggleSelect={toggleSelect}
              onMenu={setMenu}
            />
          ) : (
            <NoteCard
              key={n.id}
              note={n}
              searchQuery={searchQuery}
              isSelected={selectedIds.has(n.id)}
              onToggleSelect={toggleSelect}
              onMenu={setMenu}
            />
          )
        )}
      </div>

      {/* Floating macOS Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--surface-modal)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--shadow-modal)",
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 100,
            animation: "modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              paddingRight: 6,
              borderRight: "1px solid var(--border)",
            }}
          >
            <CheckCircle2 size={15} color="var(--accent)" />
            {selectedIds.size} selected
          </span>

          <button className="icon-btn" title="Toggle Pin" onClick={batchPin}>
            <Pin size={14} />
          </button>
          <button className="icon-btn" title="Toggle Favorite" onClick={batchFavorite}>
            <Star size={14} color="var(--warning)" />
          </button>

          <div style={{ position: "relative" }}>
            <button
              className="icon-btn"
              title="Move to Category"
              onClick={() => setBatchCategoryOpen((v) => !v)}
            >
              <Folder size={14} />
            </button>
            {batchCategoryOpen && (
              <div
                className="menu-wrap dropdown"
                style={{ bottom: 38, left: 0 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button className="menu-item" onClick={() => batchSetCategory(null)}>
                  No category
                </button>
                <div className="menu-sep" />
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className="menu-item"
                    onClick={() => batchSetCategory(c.id)}
                  >
                    <span className="category-dot" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="icon-btn danger" title="Move to Trash" onClick={batchTrash}>
            <Trash2 size={14} />
          </button>

          <button
            className="btn small"
            style={{ marginLeft: 4, height: 22, padding: "0 8px" }}
            onClick={selectAll}
            title="Select all notes in this view"
          >
            All
          </button>
          <button
            className="btn small"
            style={{ height: 22, padding: "0 8px" }}
            onClick={clearSelection}
          >
            Done
          </button>
        </div>
      )}

      {menu && (
        <div
          className="menu-wrap"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="menu-item"
            onClick={() => {
              openNoteInTab(menu.note);
              setMenu(null);
            }}
          >
            <StickyNote size={13} /> Open
          </button>
          <button
            className="menu-item"
            onClick={() => {
              useTabs
                .getState()
                .openNoteNewTab(
                  menu.note.id,
                  menu.note.title || "Untitled",
                  menu.note.pinned
                );
              setMenu(null);
            }}
          >
            <FilePlus2 size={13} /> Open in New Tab
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item"
            onClick={() => {
              useNotes.getState().togglePin(menu.note.id);
              setMenu(null);
            }}
          >
            <Pin size={13} /> {menu.note.pinned ? "Unpin Note" : "Pin Note"}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              useNotes.getState().toggleFavorite(menu.note.id);
              setMenu(null);
            }}
          >
            <Star size={13} />{" "}
            {menu.note.favorite ? "Remove Favorite" : "Favorite"}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              duplicateNote(menu.note);
              setMenu(null);
            }}
          >
            <FilePlus2 size={13} /> Duplicate
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item"
            onClick={() => {
              copyText(menu.note.content, "Markdown copied");
              setMenu(null);
            }}
          >
            Copy Markdown
          </button>
          <button
            className="menu-item"
            onClick={() => {
              exportNoteMarkdown(menu.note.title, menu.note.content);
              setMenu(null);
            }}
          >
            Export .md File…
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item danger"
            onClick={() => {
              playTrashSound();
              useNotes.getState().deleteNote(menu.note.id);
              setMenu(null);
            }}
          >
            <Trash2 size={13} /> Move to Trash
          </button>
        </div>
      )}
    </div>
  );
}
