import { Clipboard, ClipboardCopy, FilePlus2, Trash2, X } from "lucide-react";
import { useState } from "react";
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

  const paste = async (content: string, id: number) => {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(content);
      setPasted(id);
      setTimeout(() => setPasted(null), 1500);
    } catch {
      notify("error", "Could not copy to clipboard");
    }
  };

  const newNoteFromClip = async (content: string) => {
    const first = content.split("\n").find((l) => l.trim())?.slice(0, 60) ?? "From clipboard";
    const note = await createNote(first, content);
    if (note) useTabs.getState().openNote(note.id, note.title || "Untitled", false);
  };

  return (
    <aside className="clip-panel">
      <div className="clip-header">
        <Clipboard size={14} />
        <h3>Clipboard History</h3>
        <button className="icon-btn" title="Clear history" onClick={clearClipboardHistory}>
          <Trash2 size={13} />
        </button>
        <button className="icon-btn" title="Close panel (⌘⇧V)" onClick={() => toggleClipboardPanel(false)}>
          <X size={13} />
        </button>
      </div>
      <div className="clip-list">
        {clipboard.length === 0 && (
          <div className="clip-empty">
            <Clipboard size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
            <div>Nothing copied yet.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Copy any text while NoteMe runs and it appears here automatically.
            </div>
          </div>
        )}
        {clipboard.map((c) => (
          <div
            key={c.id}
            className="clip-item"
            onClick={() => paste(c.content, c.id)}
            title="Click to copy again"
          >
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", userSelect: "text" }}>{c.content}</div>
            <div className="clip-meta">
              <span>{formatRelative(c.created_at)}</span>
              <span className="spacer" style={{ flex: 1 }} />
              {pasted === c.id && <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 3 }}><ClipboardCopy size={11} /> Copied</span>}
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                title="New note from this"
                onClick={(e) => { e.stopPropagation(); newNoteFromClip(c.content); }}
              >
                <FilePlus2 size={12} />
              </button>
              <button
                className="icon-btn danger"
                style={{ width: 20, height: 20 }}
                title="Remove"
                onClick={(e) => { e.stopPropagation(); removeClipboardItem(c.id); }}
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
