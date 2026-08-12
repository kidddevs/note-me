import { FilePlus2, Pin, SearchX, Star, StickyNote } from "lucide-react";
import { useMemo } from "react";
import type { Note } from "../lib/types";
import { openNoteInTab } from "../store/notes";
import { useTabs } from "../store/tabs";
import { excerpt, formatRelative } from "../lib/format";

function NoteCard({ note }: { note: Note }) {
  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      useTabs.getState().openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
    } else {
      openNoteInTab(note);
    }
  };

  return (
    <div
      className={`note-card ${note.pinned ? "pinned-card" : ""}`}
      onClick={handleClick}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          useTabs.getState().openNoteNewTab(note.id, note.title || "Untitled", note.pinned);
        }
      }}
      title={`Open — Cmd+click or middle-click to force a new tab`}
    >
      <div className="card-title">
        {note.pinned && <Pin size={12} color="var(--accent)" />}
        {note.favorite && <Star size={12} color="var(--warning)" />}
        <span>{note.title || "Untitled"}</span>
      </div>
      <div className="card-excerpt">{excerpt(note.content) || "No additional text"}</div>
      <div className="card-tags">
        {note.tags.slice(0, 3).map((t) => (
          <span key={t.id} className="tag-chip" style={{ color: t.color, background: `${t.color}1a` }}>
            {t.name}
          </span>
        ))}
      </div>
      <div className="card-meta">
        {note.category_name && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="category-dot" style={{ width: 7, height: 7, background: note.category_color ?? "var(--border-strong)" }} />
            {note.category_name}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  );
}

export function NoteList({
  notes,
  emptyTitle,
  emptyMessage,
  onEmptyAction,
}: {
  notes: Note[];
  emptyTitle: string;
  emptyMessage: string;
  onEmptyAction?: () => void;
}) {
  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const rest = useMemo(() => notes.filter((n) => !n.pinned), [notes]);

  return (
    <div className="notes-grid">
      {notes.length === 0 ? (
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
      ) : (
        <>
          {pinned.length > 0 && (
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, color: "var(--text-3)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 2px 0" }}>
              <Pin size={12} /> Pinned · {pinned.length}
            </div>
          )}
          {pinned.map((n) => <NoteCard key={n.id} note={n} />)}
          {rest.length > 0 && pinned.length > 0 && (
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, color: "var(--text-3)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 2px 0" }}>
              <StickyNote size={12} /> Others
            </div>
          )}
          {rest.map((n) => <NoteCard key={n.id} note={n} />)}
        </>
      )}
    </div>
  );
}
