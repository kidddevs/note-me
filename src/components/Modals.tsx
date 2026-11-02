import { useEffect, useState } from "react";
import {
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Columns2,
  Database,
  Download,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Heart,
  Info,
  Keyboard,
  Lightbulb,
  Moon,
  Monitor,
  PenLine,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Tag,
  X,
} from "lucide-react";
import packageJson from "../../package.json";
import type { Theme } from "../lib/types";
import { MEASUREMENT_UNITS } from "../lib/measurements";
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

type PreferenceTab = "general" | "writing" | "books" | "data" | "about";

const PREFERENCE_TABS: { id: PreferenceTab; label: string; kicker: string; title: string; description: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", kicker: "Appearance & behavior", title: "General", description: "Make the workspace feel like yours.", icon: <SlidersHorizontal size={15} /> },
  { id: "writing", label: "Writing", kicker: "Notes workspace", title: "Writing", description: "Tune the default writing surface and editor comfort.", icon: <PenLine size={15} /> },
  { id: "books", label: "Books Studio", kicker: "Manuscript design", title: "Books Studio", description: "Choose how page measurements appear across the studio.", icon: <BookOpen size={15} /> },
  { id: "data", label: "Data & backup", kicker: "Local ownership", title: "Data & backup", description: "Your notes stay on this machine. Export them whenever you like.", icon: <Database size={15} /> },
  { id: "about", label: "About", kicker: "NoteMe", title: "About NoteMe", description: "A quiet, local-first home for notes and manuscripts.", icon: <Info size={15} /> },
];

function PreferenceSwitch({ checked, label }: { checked: boolean; label: string }) {
  return <span className={`preferences-switch ${checked ? "on" : ""}`} aria-label={label}><span /></span>;
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
  const measurementUnit = useTheme((s) => s.measurementUnit);
  const setMeasurementUnit = useTheme((s) => s.setMeasurementUnit);
  const [tab, setTab] = useState<PreferenceTab>("general");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            // skip unreadable files
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

  const THEMES: { key: Theme; label: string; detail: string; icon: React.ReactNode }[] = [
    { key: "system", label: "Auto", detail: "Follow macOS", icon: <Monitor size={15} /> },
    { key: "light", label: "Light", detail: "Paper and daylight", icon: <Sun size={15} /> },
    { key: "dark", label: "Dark", detail: "Low-light writing", icon: <Moon size={15} /> },
  ];
  const EDITOR_MODES: { key: string; label: string; detail: string; icon: React.ReactNode }[] = [
    { key: "edit", label: "Write", detail: "Markdown source", icon: <PenLine size={16} /> },
    { key: "rich", label: "Rich text", detail: "Formatting on the page", icon: <FileText size={16} /> },
    { key: "split", label: "Split", detail: "Source and preview", icon: <Columns2 size={16} /> },
    { key: "preview", label: "Preview", detail: "Reader-facing view", icon: <Eye size={16} /> },
  ];
  const activeTab = PREFERENCE_TABS.find((item) => item.id === tab) ?? PREFERENCE_TABS[0];

  return (
    <div className="preferences-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="preferences-modal" role="dialog" aria-modal="true" aria-labelledby="preferences-title">
        <aside className="preferences-rail">
          <div className="preferences-brand">
            <span className="preferences-app-icon"><img src="/note-me.png" alt="" /></span>
            <div><strong>NoteMe</strong><small>Preferences</small></div>
          </div>
          <nav className="preferences-nav" aria-label="Preferences sections">
            {PREFERENCE_TABS.map((item) => (
              <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}>
                <span className="preferences-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {tab === item.id && <ChevronRight size={13} />}
              </button>
            ))}
          </nav>
          <div className="preferences-rail-footer">
            <span className="preferences-local-badge"><ShieldCheck size={11} /> Local-first</span>
            <small>v{packageJson.version}</small>
          </div>
        </aside>

        <section className="preferences-panel">
          <header className="preferences-header">
            <div>
              <span className="preferences-kicker">{activeTab.kicker}</span>
              <h2 id="preferences-title">{activeTab.title}</h2>
              <p>{activeTab.description}</p>
            </div>
            <button className="preferences-close" onClick={onClose} aria-label="Close preferences"><X size={15} /></button>
          </header>

          <div className="preferences-body">
            {tab === "general" && <>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><Monitor size={15} /></span><div><h3>Appearance</h3><p>Choose how NoteMe follows your desktop.</p></div></div>
                <div className="preferences-theme-grid">
                  {THEMES.map((option) => (
                    <button key={option.key} className={`preferences-theme-card ${theme === option.key ? "active" : ""}`} onClick={() => setTheme(option.key)}>
                      <span className={`preferences-theme-preview ${option.key}`} aria-hidden="true"><span /><span /><span /></span>
                      <span className="preferences-theme-copy"><strong>{option.label}</strong><small>{option.detail}</small></span>
                      {theme === option.key && <Check size={14} className="preferences-check" />}
                    </button>
                  ))}
                </div>
              </section>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><Sparkles size={15} /></span><div><h3>Comfort</h3><p>Small cues that make the workspace feel alive.</p></div></div>
                <div className="preferences-toggle-list">
                  <button className="preferences-toggle-row" role="switch" aria-checked={soundEffects} onClick={() => setSoundEffects(!soundEffects)}>
                    <span><strong>Sound effects</strong><small>Task complete, save, and trash sounds</small></span>
                    <PreferenceSwitch checked={soundEffects} label="Sound effects" />
                  </button>
                  <button className="preferences-toggle-row" role="switch" aria-checked={spellcheck} onClick={() => setSpellcheck(!spellcheck)}>
                    <span><strong>Spell check</strong><small>Underline misspellings while writing</small></span>
                    <PreferenceSwitch checked={spellcheck} label="Spell check" />
                  </button>
                </div>
              </section>
            </>}

            {tab === "writing" && <>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><FileText size={15} /></span><div><h3>Default editor layout</h3><p>Open new notes in the view you reach for most.</p></div></div>
                <div className="preferences-mode-grid">
                  {EDITOR_MODES.map((option) => (
                    <button key={option.key} className={`preferences-mode-card ${editorMode === option.key ? "active" : ""}`} onClick={() => setEditorMode(option.key as never)}>
                      <span className="preferences-mode-icon">{option.icon}</span>
                      <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                      {editorMode === option.key && <Check size={13} className="preferences-check" />}
                    </button>
                  ))}
                </div>
              </section>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><PenLine size={15} /></span><div><h3>Editor text size</h3><p>Choose a comfortable reading scale for long writing sessions.</p></div></div>
                <div className="preferences-font-grid">
                  {([{ key: "sm", label: "Small", size: "13 px" }, { key: "md", label: "Medium", size: "14 px" }, { key: "lg", label: "Large", size: "16 px" }] as const).map((option) => (
                    <button key={option.key} className={`preferences-font-card ${fontSize === option.key ? "active" : ""}`} onClick={() => setFontSize(option.key)}>
                      <span style={{ fontSize: option.key === "sm" ? 15 : option.key === "md" ? 18 : 22 }}>Aa</span>
                      <span><strong>{option.label}</strong><small>{option.size}</small></span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="preferences-section preferences-callout">
                <span className="preferences-section-icon"><Keyboard size={15} /></span>
                <div><h3>Keyboard-first by design</h3><p>Quick Capture, clipboard history, tabs, and the command palette all have shortcuts.</p><button className="btn small" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("open-shortcuts")); }}><Keyboard size={13} /> View all shortcuts</button></div>
              </section>
            </>}

            {tab === "books" && <>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><Ruler size={15} /></span><div><h3>Measurement unit</h3><p>Applied to page size, margins, rulers, and pattern spacing throughout Books Studio.</p></div></div>
                <div className="preferences-unit-grid">
                  {MEASUREMENT_UNITS.map((option) => (
                    <button key={option.value} className={`preferences-unit-card ${measurementUnit === option.value ? "active" : ""}`} onClick={() => setMeasurementUnit(option.value)}>
                      <span className="preferences-unit-glyph">{option.short}</span>
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                      {measurementUnit === option.value && <Check size={13} className="preferences-check" />}
                    </button>
                  ))}
                </div>
                <p className="preferences-note">1 in = 2.54 cm = 96 px. Values are stored in inches for export fidelity and converted only for display and input.</p>
              </section>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><BookOpen size={15} /></span><div><h3>Page systems</h3><p>Paper presets, full-bleed placement, and print-ready trim sizes live in Book settings.</p></div></div>
                <div className="preferences-info-card"><strong>Journal-ready</strong><span>Blank, ruled, dot grid, graph, and planner pages are available from the Page appearance panel.</span></div>
              </section>
            </>}

            {tab === "data" && <>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><Database size={15} /></span><div><h3>Local library</h3><p>No account, cloud sync, or telemetry. Everything is stored in SQLite on this machine.</p></div></div>
                <div className="preferences-path"><code>~/Library/Application Support/com.dakid.noteme/</code><span className="preferences-local-badge"><ShieldCheck size={11} /> Private</span></div>
              </section>
              <section className="preferences-section">
                <div className="preferences-section-head"><span className="preferences-section-icon"><Download size={15} /></span><div><h3>Export &amp; backup</h3><p>Write every note to a folder as portable Markdown files.</p></div></div>
                <button className="btn" onClick={exportAll} disabled={exporting}><Download size={14} /> {exporting ? "Exporting…" : "Export all notes as Markdown"}</button>
              </section>
            </>}

            {tab === "about" && <>
              <section className="preferences-about-card">
                <span className="preferences-about-icon"><img src="/note-me.png" alt="" /></span>
                <div><span className="preferences-kicker">NoteMe v{packageJson.version}</span><h3>A quiet, local-first home for your notes and manuscripts.</h3><p>Built with Tauri, React, and SQLite. Your words stay on your machine.</p></div>
              </section>
              <div className="preferences-about-actions">
                <button className="btn small" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("open-shortcuts")); }}><Keyboard size={13} /> Keyboard shortcuts</button>
                <span className="preferences-local-badge"><ShieldCheck size={11} /> MIT licensed</span>
              </div>
            </>}
          </div>
        </section>
      </div>
    </div>
  );
}
