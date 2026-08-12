import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  Download,
  Folder,
  FolderPlus,
  Heart,
  Lightbulb,
  Moon,
  Monitor,
  Sparkles,
  Star,
  Sun,
  Tag,
  X,
} from "lucide-react";
import type { Theme } from "../lib/types";
import { api } from "../lib/api";
import { useTheme } from "../store/theme";
import { useNotes } from "../store/notes";
import { notify } from "../store/toast";

const COLORS = [
  "#64748b", "#0f766e", "#2563eb", "#7c3aed", "#c026d3",
  "#db2777", "#ea580c", "#ca8a04", "#16a34a", "#dc2626",
];

const ICONS: Record<string, React.ReactNode> = {
  Folder: <Folder size={16} />,
  Book: <BookOpen size={16} />,
  Briefcase: <Briefcase size={16} />,
  Heart: <Heart size={16} />,
  Lightbulb: <Lightbulb size={16} />,
  Sparkles: <Sparkles size={16} />,
  Star: <Star size={16} />,
  Tag: <Tag size={16} />,
};

export function Modal({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function CategoryModal({ onClose, onCreate, initial }: {
  onClose: () => void;
  onCreate: (name: string, color: string, icon: string) => Promise<void> | void;
  initial?: { id: number; name: string; color: string; icon: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[2]);
  const [icon, setIcon] = useState(initial?.icon ?? "Folder");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await api.updateCategory(initial.id, name.trim(), color, icon);
        await useNotes.getState().refresh();
        notify("success", "Category updated");
      } else {
        await onCreate(name.trim(), color, icon);
      }
      onClose();
    } catch (e) {
      notify("error", "Failed to save category", String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? "Edit Category" : "New Category"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving || !name.trim()}>
            <FolderPlus size={14} /> {initial ? "Save" : "Create"}
          </button>
        </>
      }
    >
      <div className="form-row">
        <label>Name</label>
        <input
          className="input"
          autoFocus
          value={name}
          placeholder="e.g. Work, Personal, Ideas"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </div>
      <div className="form-row">
        <label>Color</label>
        <div className="color-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>Icon</label>
        <div className="icon-picker">
          {Object.entries(ICONS).map(([k, iconNode]) => (
            <button key={k} className={icon === k ? "selected" : ""} onClick={() => setIcon(k)} title={k}>
              {iconNode}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function TagPickerModal({ noteId, onClose }: { noteId: number; onClose: () => void }) {
  const tags = useNotes((s) => s.tags);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    await api.setNoteTags(noteId, [...selected]);
    await useNotes.getState().refresh();
    notify("success", "Tags updated");
    onClose();
  };

  return (
    <Modal
      title="Manage Tags"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Apply</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tags.map((t) => (
          <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selected.has(t.id)}
              onChange={() => toggle(t.id)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="category-dot" style={{ background: t.color }} />
            {t.name}
          </label>
        ))}
        {tags.length === 0 && (
          <div style={{ color: "var(--text-3)", padding: 8 }}>No tags exist yet. Create one from the sidebar.</div>
        )}
      </div>
    </Modal>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const editorMode = useTheme((s) => s.editorMode);
  const setEditorMode = useTheme((s) => s.setEditorMode);
  const [exporting, setExporting] = useState(false);

  const exportAll = async () => {
    setExporting(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const dir = await open({ directory: true, title: "Choose export folder" });
      if (typeof dir === "string" && dir) {
        const s = useNotes.getState();
        const all = [...s.notes, ...s.archived];
        let count = 0;
        for (const n of all) {
          const name = (n.title || "Untitled").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
          try {
            await writeTextFile(`${dir}/${name}.md`, `# ${n.title || "Untitled"}\n\n${n.content}\n\n---\n_Created ${n.created_at} · Updated ${n.updated_at}_`);
            count++;
          } catch {
            // skip
          }
        }
        notify("success", `Exported ${count} notes`, dir);
      }
    } catch {
      notify("error", "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const THEMES: { key: Theme; label: string; icon: React.ReactNode }[] = [
    { key: "system", label: "System", icon: <Monitor size={15} /> },
    { key: "light", label: "Light", icon: <Sun size={15} /> },
    { key: "dark", label: "Dark", icon: <Moon size={15} /> },
  ];

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="form-row">
        <label>Appearance</label>
        <div style={{ display: "flex", gap: 8 }}>
          {THEMES.map((t) => (
            <button
              key={t.key}
              className={`filter-chip ${theme === t.key ? "active" : ""}`}
              onClick={() => setTheme(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>Default Editor Layout</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "edit", label: "Write" },
            { key: "rich", label: "Rich Text" },
            { key: "split", label: "Split View" },
            { key: "preview", label: "Preview" },
          ].map((m) => (
            <button
              key={m.key}
              className={`filter-chip ${editorMode === m.key ? "active" : ""}`}
              onClick={() => setEditorMode(m.key as never)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>Data</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={exportAll} disabled={exporting}>
            <Download size={14} /> {exporting ? "Exporting…" : "Export All Notes as Markdown"}
          </button>
        </div>
      </div>
      <div className="form-row">
        <label>Global Shortcuts</label>
        <div style={{ fontSize: 12, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 6 }}>
          <span><kbd>⌘⇧N</kbd> Quick capture (works anywhere on your system)</span>
          <span><kbd>⌘⇧V</kbd> Toggle clipboard history panel</span>
        </div>
      </div>
      <div className="form-row">
        <label>About</label>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          NoteMe v0.1.0 — local-first notes for Mac, Windows &amp; Linux. All data stays on this device.
        </div>
      </div>
    </Modal>
  );
}
