import { Archive, FilePlus2, Hash, Inbox, RotateCcw, Search, Star, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ViewKind } from "../lib/types";
import { useNotes } from "../store/notes";
import { useNotes as useNotesData } from "../store/notes";
import { useTabs } from "../store/tabs";
import { NoteList } from "./NoteList";
import { notify } from "../store/toast";

interface ViewTabProps {
  view: { kind: ViewKind; id?: number; query?: string };
  title: string;
}

export function ViewTab({ view, title }: ViewTabProps) {
  const notes = useNotesData((s) => s.notes);
  const archived = useNotesData((s) => s.archived);
  const trashed = useNotesData((s) => s.trashed);
  const categories = useNotesData((s) => s.categories);
  const tags = useNotesData((s) => s.tags);
  const searchQuery = useNotesData((s) => s.searchQuery);
  const setSearchQuery = useNotesData((s) => s.setSearchQuery);
  const createNote = useNotesData((s) => s.createNote);
  const restoreNote = useNotesData((s) => s.restoreNote);
  const deleteForever = useNotesData((s) => s.deleteForever);
  const emptyTrash = useNotesData((s) => s.emptyTrash);
  const refresh = useNotesData((s) => s.refresh);
  const [sort, setSort] = useState<"updated" | "created" | "alpha">("updated");

  const list = useMemo(() => {
    let l: typeof notes;
    switch (view.kind) {
      case "favorites": l = useNotes.getState().notes.filter((n) => n.favorite); break;
      case "archived": l = archived; break;
      case "trash": l = trashed; break;
      case "category": l = notes.filter((n) => n.category_id === view.id); break;
      case "tag": l = notes.filter((n) => n.tags.some((t) => t.id === view.id)); break;
      case "search": {
        const q = view.query ?? searchQuery;
        if (!q) l = [];
        else {
          const ql = q.toLowerCase();
          l = notes.filter((n) => (n.title + " " + n.content).toLowerCase().includes(ql));
        }
        break;
      }
      default: l = notes;
    }
    const sorted = [...l];
    if (sort === "updated") sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    else if (sort === "created") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [view, notes, archived, trashed, searchQuery, sort]);

  useEffect(() => {
    if (view.kind === "search" && view.query && view.query !== searchQuery) {
      setSearchQuery(view.query ?? "");
    }
  }, [view.kind, view.query]);

  const sub = (() => {
    switch (view.kind) {
      case "category": return categories.find((c) => c.id === view.id)?.name;
      case "tag": return tags.find((t) => t.id === view.id)?.name;
      case "search": return view.query;
      default: return null;
    }
  })();

  const newNote = async () => {
    const note = await createNote();
    if (note) {
      const id = useTabs.getState().openNote(note.id, note.title || "Untitled", false);
      if (view.kind === "category") {
        await useNotes.getState().setCategory(note.id, view.id ?? null);
        refresh();
      }
      return id;
    }
    return null;
  };

  const icon = view.kind === "favorites" ? <Star size={15} /> :
    view.kind === "archived" ? <Archive size={15} /> :
    view.kind === "trash" ? <Trash2 size={15} /> :
    view.kind === "search" ? <Search size={15} /> :
    view.kind === "tag" ? <Hash size={15} /> :
    view.kind === "category" ? <span className="category-dot" style={{ background: categories.find((c) => c.id === view.id)?.color }} /> :
    <Inbox size={15} />;

  return (
    <div className="note-list">
      <div className="list-header">
        <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
        <h2>{view.kind === "search" ? `Search: ${view.query}` : view.kind === "category" || view.kind === "tag" ? sub ?? title : title}</h2>
        <span className="count">{list.length} {list.length === 1 ? "note" : "notes"}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="seg" style={{ display: "inline-flex" }}>
          <button
            className={sort === "updated" ? "active" : ""}
            title="Sort by last updated"
            onClick={() => setSort("updated")}
          >
            <span style={{ fontSize: 10.5, padding: "0 5px" }}>Updated</span>
          </button>
          <button
            className={sort === "created" ? "active" : ""}
            title="Sort by created"
            onClick={() => setSort("created")}
          >
            <span style={{ fontSize: 10.5, padding: "0 5px" }}>Created</span>
          </button>
          <button
            className={sort === "alpha" ? "active" : ""}
            title="Sort alphabetically"
            onClick={() => setSort("alpha")}
          >
            <span style={{ fontSize: 10.5, padding: "0 5px" }}>A–Z</span>
          </button>
        </div>
        {view.kind !== "trash" && (
          <button className="btn primary" onClick={newNote}>
            <FilePlus2 size={14} /> New
          </button>
        )}
        {view.kind === "trash" && trashed.length > 0 && (
          <>
            <button
              className="btn danger"
              onClick={async () => {
                if (window.confirm("Permanently delete all notes in trash?")) {
                  await emptyTrash();
                  notify("info", "Trash emptied");
                }
              }}
            >
              <Trash2 size={13} /> Empty Trash
            </button>
          </>
        )}
      </div>

      {view.kind === "search" && (
        <div className="view-filters">
          <div className="search-box" style={{ flex: 1, maxWidth: 420 }}>
            <Search size={13} />
            <input
              placeholder="Refine search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              spellCheck={false}
            />
            {searchQuery && (
              <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setSearchQuery("")}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {view.kind === "trash" ? (
        <div className="notes-grid">
          {trashed.map((n) => (
            <div key={n.id} className="note-card" style={{ cursor: "default" }}>
              <div className="card-title"><span>{n.title || "Untitled"}</span></div>
              <div className="card-excerpt">{n.content.slice(0, 160) || "No additional text"}</div>
              <div className="card-meta">
                <span>{n.category_name ?? "No category"}</span>
                <span style={{ marginLeft: "auto" }}>{n.trashed ? "Trashed" : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn small" onClick={() => restoreNote(n.id)}>
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  className="btn small danger"
                  onClick={async () => {
                    if (window.confirm(`Permanently delete "${n.title || "Untitled"}"?`)) {
                      await deleteForever(n.id);
                      notify("info", "Note permanently deleted");
                    }
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
          {trashed.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Trash2 size={24} /></div>
              <h3>Trash is empty</h3>
              <p>Deleted notes land here until you restore or permanently delete them.</p>
            </div>
          )}
        </div>
      ) : view.kind === "archived" ? (
        <NoteList
          notes={archived}
          emptyTitle="No archived notes"
          emptyMessage="Archive notes you want to keep but hide from your main list."
        />
      ) : (
        <NoteList
          notes={list}
          emptyTitle={view.kind === "search" ? "No matches" : view.kind === "category" ? "No notes in this category" : view.kind === "tag" ? "No notes with this tag" : "No notes yet"}
          emptyMessage={view.kind === "search" ? "Try different keywords." : "Create your first note and it will show up here."}
          onEmptyAction={view.kind !== "search" ? newNote : undefined}
        />
      )}
    </div>
  );
}
