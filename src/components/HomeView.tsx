import {
  CalendarDays,
  FolderOpen,
  NotebookPen,
  Pin,
  Search,
  SquarePen,
  Star,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNotes, openNoteInTab } from "../store/notes";
import { useTabs } from "../store/tabs";
import { formatCardDate, stripMarkdown } from "../lib/format";
import { createFromTemplate } from "../lib/actions";
import { playSaveChime, playTrashSound } from "../lib/sounds";

export function HomeView() {
  const notes = useNotes((s) => s.notes);
  const stats = useNotes((s) => s.stats);
  const createNote = useNotes((s) => s.createNote);
  const togglePin = useNotes((s) => s.togglePin);
  const toggleFavorite = useNotes((s) => s.toggleFavorite);
  const deleteNote = useNotes((s) => s.deleteNote);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned" | "favorites" | "recent">("all");

  const filteredNotes = useMemo(() => {
    let list = [...notes];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => (n.title + " " + n.content).toLowerCase().includes(q));
    }
    if (filter === "pinned") {
      list = list.filter((n) => n.pinned);
    } else if (filter === "favorites") {
      list = list.filter((n) => n.favorite);
    } else if (filter === "recent") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const iso = sevenDaysAgo.toISOString();
      list = list.filter((n) => n.updated_at >= iso);
    }
    // Sort by updated_at descending
    list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return list;
  }, [notes, search, filter]);

  const handleNewNote = async () => {
    playSaveChime();
    const note = await createNote();
    if (note) openNoteInTab(note);
  };

  return (
    <div className="home-view">
      <div className="home-container">
        {/* Big Prominent New Note Button (Screenshot Style) */}
        <button className="home-new-btn" onClick={handleNewNote} title="Create new note (⌘N)">
          <SquarePen size={18} />
          <span>New Note</span>
        </button>

        {/* Quick Template Action Pills */}
        <div className="home-templates-bar">
          <button
            className="home-pill-btn"
            onClick={() => createFromTemplate("daily")}
            title="Create today's daily note"
          >
            <CalendarDays size={13} color="var(--indigo)" />
            <span>Daily Note</span>
          </button>
          <button
            className="home-pill-btn"
            onClick={() => createFromTemplate("meeting")}
            title="Create meeting notes"
          >
            <StickyNote size={13} color="var(--teal)" />
            <span>Meeting</span>
          </button>
          <button
            className="home-pill-btn"
            onClick={() => createFromTemplate("journal")}
            title="Create journal entry"
          >
            <NotebookPen size={13} color="var(--purple)" />
            <span>Journal</span>
          </button>
        </div>

        {/* Instant Search Bar */}
        <div className="home-search-wrap">
          <div className="search-box" style={{ height: 32, borderRadius: "var(--radius-md)" }}>
            <Search size={14} style={{ flexShrink: 0 }} />
            <input
              placeholder="Filter your notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              spellCheck={false}
            />
            {search && (
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Folder Header Row (Screenshot Style) */}
        <div className="home-section-header">
          <div className="home-section-title">
            <FolderOpen size={17} color="var(--text-2)" />
            <span>Open</span>
          </div>
          <span className="home-section-count">{stats.total_notes}</span>
        </div>

        {/* Filter Pills */}
        <div className="home-filter-tabs">
          <button
            className={`home-tab-pill ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`home-tab-pill ${filter === "pinned" ? "active" : ""}`}
            onClick={() => setFilter("pinned")}
          >
            <Pin size={11} /> Pinned ({notes.filter((n) => n.pinned).length})
          </button>
          <button
            className={`home-tab-pill ${filter === "favorites" ? "active" : ""}`}
            onClick={() => setFilter("favorites")}
          >
            <Star size={11} color="var(--warning)" /> Favorites ({notes.filter((n) => n.favorite).length})
          </button>
          <button
            className={`home-tab-pill ${filter === "recent" ? "active" : ""}`}
            onClick={() => setFilter("recent")}
          >
            Recent
          </button>
        </div>

        {/* Notes Feed Stack (Screenshot Style) */}
        <div className="home-notes-stack">
          {filteredNotes.length === 0 ? (
            <div className="home-empty">
              <StickyNote size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>{search ? "No matching notes found" : "No notes yet"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4 }}>
                {search ? "Try clearing your search." : "Click New Note above to create your first note."}
              </div>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const excerptLines = note.content
                ? note.content
                    .split("\n")
                    .map((l) => stripMarkdown(l).trim())
                    .filter(Boolean)
                    .slice(0, 3)
                    .join("\n")
                : "No additional text";

              return (
                <div
                  key={note.id}
                  className={`home-card ${note.pinned ? "pinned" : ""}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.button === 1) {
                      useTabs
                        .getState()
                        .openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
                    } else {
                      openNoteInTab(note);
                    }
                  }}
                  title="Click to open in Editor · ⌘-click for new tab"
                >
                  {/* Card Actions on Hover */}
                  <div className="home-card-actions">
                    <button
                      className={`icon-btn ${note.favorite ? "active" : ""}`}
                      title={note.favorite ? "Unfavorite" : "Favorite"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(note.id);
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
                      <Pin size={12} color={note.pinned ? "var(--accent)" : "currentColor"} />
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

                  {/* Date Header (Centered or clean) */}
                  <div className="home-card-date">
                    {formatCardDate(note.updated_at)}
                  </div>

                  {/* Title */}
                  <div className="home-card-title">
                    {note.pinned && <Pin size={12} color="var(--accent)" style={{ flexShrink: 0 }} />}
                    {note.favorite && <Star size={12} color="var(--warning)" style={{ flexShrink: 0 }} />}
                    <span>{note.title || "Untitled"}</span>
                  </div>

                  {/* Content snippet */}
                  <div className="home-card-snippet">
                    {excerptLines}
                  </div>

                  {/* Category & Tags Footer if present */}
                  {(note.category_name || note.tags.length > 0) && (
                    <div className="home-card-footer">
                      {note.category_name && (
                        <span className="home-category-badge">
                          <span
                            className="category-dot"
                            style={{
                              width: 6,
                              height: 6,
                              background: note.category_color ?? "var(--accent)",
                            }}
                          />
                          {note.category_name}
                        </span>
                      )}
                      {note.tags.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="tag-chip"
                          style={{
                            fontSize: 10,
                            padding: "0 6px",
                            color: t.color,
                            background: `${t.color}18`,
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
