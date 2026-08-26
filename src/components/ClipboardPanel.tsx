import {
  Check,
  Clipboard,
  FilePlus2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNotes } from "../store/notes";
import { useTabs } from "../store/tabs";
import { notify } from "../store/toast";
import { formatRelative } from "../lib/format";

export function ClipboardPanel() {
  const clipboard = useNotes((s) => s.clipboard);
  const toggleClipboardPanel = useNotes((s) => s.toggleClipboardPanel);
  const clearClipboardHistory = useNotes((s) => s.clearClipboardHistory);
  const removeClipboardItem = useNotes((s) => s.removeClipboardItem);
  const createNote = useNotes((s) => s.createNote);
  const [pasted, setPasted] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return clipboard;
    const q = filterQuery.toLowerCase();
    return clipboard.filter((c) => c.content.toLowerCase().includes(q));
  }, [clipboard, filterQuery]);

  const paste = async (content: string, id: number) => {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(content);
      setPasted(id);
      setTimeout(() => setPasted(null), 1500);
      notify("success", "Copied to clipboard");
    } catch {
      notify("error", "Could not copy to clipboard");
    }
  };

  const newNoteFromClip = async (content: string) => {
    const first =
      content.split("\n").find((l) => l.trim())?.slice(0, 60) ??
      "From clipboard";
    const note = await createNote(first, content);
    if (note) {
      useTabs.getState().openNote(note.id, note.title || "Untitled", false);
      notify("success", "Note created from clipboard", first);
    }
  };

  return (
    <aside className="clip-panel">
      <div className="clip-header">
        <Clipboard size={14} color="var(--accent)" />
        <h3>Clipboard History</h3>
        {clipboard.length > 0 && (
          <button
            className="icon-btn"
            title="Clear clipboard history"
            onClick={() => {
              if (window.confirm("Clear all clipboard history?")) {
                clearClipboardHistory();
                notify("info", "Clipboard history cleared");
              }
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
        <button
          className="icon-btn"
          title="Close panel (⌘⇧V)"
          onClick={() => toggleClipboardPanel(false)}
        >
          <X size={13} />
        </button>
      </div>

      {clipboard.length > 3 && (
        <div style={{ padding: "8px 10px 0" }}>
          <div className="search-box">
            <Search size={12} />
            <input
              placeholder="Filter history…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              spellCheck={false}
            />
            {filterQuery && (
              <button
                className="icon-btn"
                style={{ width: 18, height: 18 }}
                onClick={() => setFilterQuery("")}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="clip-list">
        {filtered.length === 0 && (
          <div className="clip-empty">
            <Clipboard size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>{filterQuery ? "No matching clips" : "Nothing copied yet"}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-3)" }}>
              {filterQuery
                ? "Try a different search."
                : "Copy any text while NoteMe runs and it will appear here."}
            </div>
          </div>
        )}
        {filtered.map((c) => (
          <div
            key={c.id}
            className="clip-item"
            onClick={() => paste(c.content, c.id)}
            title="Click to copy to clipboard"
          >
            <div className="clip-content">{c.content}</div>
            <div className="clip-meta">
              <span>{formatRelative(c.created_at)}</span>
              <span className="spacer" style={{ flex: 1 }} />
              {pasted === c.id ? (
                <span
                  style={{
                    color: "var(--success)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontWeight: 600,
                  }}
                >
                  <Check size={11} /> Copied
                </span>
              ) : null}
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                title="Create new note from this clip"
                onClick={(e) => {
                  e.stopPropagation();
                  newNoteFromClip(c.content);
                }}
              >
                <FilePlus2 size={12} />
              </button>
              <button
                className="icon-btn danger"
                style={{ width: 20, height: 20 }}
                title="Remove from history"
                onClick={(e) => {
                  e.stopPropagation();
                  removeClipboardItem(c.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
