import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  Download,
  Folder,
  FolderPlus,
  Heart,
  Keyboard,
  Lightbulb,
  Moon,
  Monitor,
  Sparkles,
  Star,
  Sun,
  Tag,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Theme } from "../lib/types";
import { api } from "../lib/api";
import { useTheme } from "../store/theme";
import { useNotes } from "../store/notes";
import { notify } from "../store/toast";

const COLORS = [
  "#a56b3e", // Books Studio accent
  "#5856d6", // System Indigo
  "#af52de", // System Purple
  "#ff2d55", // System Pink
  "#ff3b30", // System Red
  "#ff9500", // System Orange
  "#ffcc00", // System Yellow
  "#34c759", // System Green
  "#00c7be", // System Mint / Teal
  "#8e8e93", // System Gray
];

const ICONS: Record<string, React.ReactNode> = {
  Folder: <Folder size={15} />,
  Book: <BookOpen size={15} />,
  Briefcase: <Briefcase size={15} />,
  Heart: <Heart size={15} />,
  Lightbulb: <Lightbulb size={15} />,
  Sparkles: <Sparkles size={15} />,
  Star: <Star size={15} />,
  Tag: <Tag size={15} />,
};

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
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
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            <X size={14} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function CategoryModal({
  onClose,
  onCreate,
  initial,
}: {
  onClose: () => void;
  onCreate: (name: string, color: string, icon: string) => Promise<void> | void;
  initial?: { id: number; name: string; color: string; icon: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? "Folder");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await api.updateCategory(initial.id, name.trim(), color, icon);
        await useNotes.getState().refresh();
        notify("success", "Category updated", name.trim());
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
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={save}
            disabled={saving || !name.trim()}
          >
            <FolderPlus size={14} /> {initial ? "Save Changes" : "Create Category"}
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
          placeholder="e.g. Work, Ideas, Personal"
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
            <button
              key={k}
              className={icon === k ? "selected" : ""}
              onClick={() => setIcon(k)}
              title={k}
            >
              {iconNode}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function TagPickerModal({
  noteId,
  onClose,
}: {
  noteId: number;
  onClose: () => void;
}) {
  const tags = useNotes((s) => s.tags);
  const note = useNotes((s) => s.notes.find((n) => n.id === noteId));
  const [selected, setSelected] = useState<Set<number>>(
    new Set(note?.tags.map((t) => t.id) ?? [])
  );

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
      title="Manage Note Tags"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Apply Tags
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {tags.map((t) => (
          <label
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 10px",
              borderRadius: 6,
              cursor: "pointer",
              background: selected.has(t.id) ? "var(--surface-hover)" : "transparent",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(t.id)}
              onChange={() => toggle(t.id)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ fontWeight: selected.has(t.id) ? 550 : 450 }}>{t.name}</span>
          </label>
        ))}
        {tags.length === 0 && (
          <div style={{ color: "var(--text-3)", padding: 12, textAlign: "center" }}>
            No tags exist yet. Create a tag using the + button in the sidebar.
          </div>
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
  const fontSize = useTheme((s) => s.fontSize);
  const setFontSize = useTheme((s) => s.setFontSize);
  const spellcheck = useTheme((s) => s.spellcheck);
  const setSpellcheck = useTheme((s) => s.setSpellcheck);
  const soundEffects = useTheme((s) => s.soundEffects);
  const setSoundEffects = useTheme((s) => s.setSoundEffects);
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
          const name = (n.title || "Untitled")
            .replace(/[\\/:*?"<>|]/g, "_")
            .slice(0, 120);
          try {
            await writeTextFile(
              `${dir}/${name}.md`,
              `# ${n.title || "Untitled"}\n\n${n.content}\n\n---\n_Created ${n.created_at} · Updated ${n.updated_at}_`
            );
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
    { key: "system", label: "Auto", icon: <Monitor size={14} /> },
    { key: "light", label: "Light", icon: <Sun size={14} /> },
    { key: "dark", label: "Dark", icon: <Moon size={14} /> },
  ];

  return (
    <Modal title="Preferences" onClose={onClose}>
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
        <label>Editor Font Size &amp; Features</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([
            { key: "sm", label: "Small" },
            { key: "md", label: "Medium" },
            { key: "lg", label: "Large" },
          ] as const).map((f) => (
            <button
              key={f.key}
              className={`filter-chip ${fontSize === f.key ? "active" : ""}`}
              onClick={() => setFontSize(f.key)}
            >
              {f.label}
            </button>
          ))}
          <button
            className={`filter-chip ${spellcheck ? "active" : ""}`}
            onClick={() => setSpellcheck(!spellcheck)}
            title="Toggle spell check in the editor"
          >
            Spell Check {spellcheck ? "On" : "Off"}
          </button>
          <button
            className={`filter-chip ${soundEffects ? "active" : ""}`}
            onClick={() => setSoundEffects(!soundEffects)}
            title="Toggle sound effects (task complete, trash, save)"
          >
            {soundEffects ? <Volume2 size={13} /> : <VolumeX size={13} />} Sound Effects {soundEffects ? "On" : "Off"}
          </button>
        </div>
      </div>
      <div className="form-row">
        <label>Data &amp; Backup</label>
        <div>
          <button className="btn" onClick={exportAll} disabled={exporting}>
            <Download size={14} />{" "}
            {exporting ? "Exporting…" : "Export All Notes as Markdown (.md)"}
          </button>
        </div>
      </div>
      <div className="form-row">
        <label>Keyboard Shortcuts</label>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface-2)",
            padding: "10px 12px",
            borderRadius: 8,
          }}
        >
          <span>View all keyboard shortcuts and global triggers</span>
          <button
            className="btn small"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("open-shortcuts"));
            }}
          >
            <Keyboard size={13} /> View Shortcuts (<kbd>⌘/</kbd>)
          </button>
        </div>
      </div>
      <div className="form-row" style={{ marginBottom: 0 }}>
        <label>About</label>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          NoteMe v0.1.0 · Fast, local-first notes for macOS. All data is securely stored locally on your device in SQLite.
        </div>
      </div>
    </Modal>
  );
}
