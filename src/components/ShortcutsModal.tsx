import { Keyboard, X } from "lucide-react";
import { useEffect } from "react";

interface ShortcutGroup {
  category: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "General & Navigation",
    shortcuts: [
      { keys: ["⌘", "N"], description: "New note" },
      { keys: ["⌘", "T"], description: "New tab / Browse all" },
      { keys: ["⌘", "W"], description: "Close active tab" },
      { keys: ["⌘", "K"], description: "Command palette" },
      { keys: ["⌘", "⌃", "S"], description: "Toggle sidebar" },
      { keys: ["⌘", "⇧", "T"], description: "Toggle appearance (Dark/Light)" },
      { keys: ["⌘", "⇧", "}"], description: "Next tab" },
      { keys: ["⌘", "⇧", "{"], description: "Previous tab" },
      { keys: ["⌘", ","], description: "Preferences" },
      { keys: ["⌘", "/"], description: "Keyboard shortcuts cheatsheet" },
    ],
  },
  {
    category: "Editor & Formatting",
    shortcuts: [
      { keys: ["⌘", "B"], description: "Bold text (**text**)" },
      { keys: ["⌘", "I"], description: "Italic text (*text*)" },
      { keys: ["⌘", "1"], description: "Heading 1 (#)" },
      { keys: ["⌘", "2"], description: "Heading 2 (##)" },
      { keys: ["⌘", "K"], description: "Insert link ([title](url))" },
      { keys: ["⌘", "F"], description: "Find & replace in note" },
      { keys: ["⌘", "⇧", "D"], description: "Duplicate current note" },
      { keys: ["⌘", "P"], description: "Print note / PDF export" },
      { keys: ["⌘", "Z"], description: "Undo" },
      { keys: ["⌘", "⇧", "Z"], description: "Redo" },
    ],
  },
  {
    category: "System & Quick Tools",
    shortcuts: [
      { keys: ["⌘", "⇧", "N"], description: "Global Quick Capture (system-wide)" },
      { keys: ["⌘", "⇧", "V"], description: "Clipboard History Inspector" },
      { keys: ["⌘", "↵"], description: "Save & close Quick Capture" },
      { keys: ["Esc"], description: "Dismiss modal / palette" },
    ],
  },
  {
    category: "Books Studio",
    shortcuts: [
      { keys: ["⌘", "1"], description: "Open library" },
      { keys: ["⌘", "2"], description: "Open manuscript" },
      { keys: ["⌘", "3"], description: "Open outline" },
      { keys: ["⌘", "4"], description: "Open book settings" },
      { keys: ["⌘", "5"], description: "Open export studio" },
      { keys: ["⌘", "K"], description: "Books command palette" },
      { keys: ["⌘", "F"], description: "Find in current section" },
      { keys: ["⌘", "⌥", "↑/↓"], description: "Previous / next section" },
      { keys: ["↑", "↓"], description: "Move through section rail" },
    ],
  },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ width: 620, maxHeight: "85vh" }}>
        <div className="modal-header">
          <Keyboard size={16} color="var(--accent)" />
          <h3>Keyboard Shortcuts</h3>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.category}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 650,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                    marginBottom: 8,
                    paddingBottom: 4,
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  {group.category}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px 16px",
                  }}
                >
                  {group.shortcuts.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ color: "var(--text)" }}>{s.description}</span>
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {s.keys.map((k, ki) => (
                          <kbd key={ki}>{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            Tip: Press <kbd>⌘/</kbd> anytime to open this sheet.
          </span>
          <button className="btn primary small" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
