import { ClipboardPaste, CornerDownLeft, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNotes } from "../store/notes";
import { useTabs } from "../store/tabs";
import { notify } from "../store/toast";

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("global-shortcut", (e) => {
      if (e.payload === "quick-capture") {
        setOpen(true);
        setText("");
        setTitle("");
        saved.current = false;
        setTimeout(() => taRef.current?.focus(), 35);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  const close = () => setOpen(false);

  const save = async () => {
    if (saved.current) return;
    if (!text.trim()) {
      close();
      return;
    }
    saved.current = true;
    const t =
      title.trim() ||
      text.split("\n").find((l) => l.trim())?.slice(0, 60) ||
      "Quick Note";
    const note = await useNotes.getState().createNote(t, text);
    if (note) {
      useTabs.getState().openNote(note.id, note.title || "Untitled", false);
      notify("success", "Quick note saved", t);
    }
    close();
  };

  const pasteClipboard = async () => {
    try {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      const t = await readText();
      if (t) {
        setText((prev) => (prev ? prev + "\n" + t : t));
        await useNotes.getState().captureClipboard();
      }
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      className="qc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="qc-box">
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 0", gap: 8 }}>
          <Sparkles size={15} color="var(--accent)" />
          <input
            className="editor-title-input"
            style={{ fontSize: 15, padding: "2px 4px" }}
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            spellCheck={false}
          />
        </div>
        <textarea
          ref={taRef}
          placeholder="Capture a thought, task, or paste content… (Markdown supported)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          spellCheck={false}
        />
        <div className="qc-footer">
          <button
            className="icon-btn"
            title="Paste from clipboard"
            onClick={pasteClipboard}
          >
            <ClipboardPaste size={14} />
          </button>
          <span className="hint">
            <kbd>⌘↵</kbd> save · <kbd>Esc</kbd> cancel
          </span>
          <button className="btn primary" onClick={save} disabled={!text.trim()}>
            <CornerDownLeft size={13} /> Save Note
          </button>
          <button className="btn" onClick={close}>
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
