import {
  Archive,
  ArrowLeft,
  Bold,
  CheckSquare,
  ClipboardCopy,
  Code2,
  Copy,
  Download,
  Eye,
  FileOutput,
  Focus,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Pin,
  Quote,
  Redo2,
  Star,
  Strikethrough,
  Tag,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { useNotes } from "../store/notes";
import { useTabs } from "../store/tabs";
import { useTheme } from "../store/theme";
import { notify } from "../store/toast";
import { charCount, firstLine, formatFull, wordCount } from "../lib/format";
import { TagPickerModal } from "./Modals";
import { RichTextEditor, type RichEditorHandle } from "./RichTextEditor";

export type EditorMode = "edit" | "rich" | "split" | "preview";

function insertWrap(area: HTMLTextAreaElement, before: string, after = before) {
  const { selectionStart: s, selectionEnd: e, value } = area;
  const selected = value.slice(s, e);
  const next = value.slice(0, s) + before + selected + after + value.slice(e);
  area.value = next;
  const pos = s + before.length;
  area.focus();
  area.setSelectionRange(pos, selected.length ? pos + selected.length : pos);
  area.dispatchEvent(new Event("input", { bubbles: true }));
  return next;
}

function insertLine(area: HTMLTextAreaElement, prefix: string, placeholder: string) {
  const { selectionStart: s, value } = area;
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  const next = value.slice(0, lineStart) + prefix + placeholder + value.slice(lineStart);
  area.value = next;
  const pos = lineStart + prefix.length;
  area.focus();
  area.setSelectionRange(pos, pos + placeholder.length);
  area.dispatchEvent(new Event("input", { bubbles: true }));
  return next;
}

function insertInline(area: HTMLTextAreaElement, marker: string) {
  const { selectionStart: s, selectionEnd: e, value } = area;
  const selected = value.slice(s, e);
  if (selected && !selected.startsWith(marker)) {
    return insertWrap(area, marker, marker);
  }
  if (selected.startsWith(marker)) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    const next = value.slice(0, s) + inner + value.slice(e);
    area.value = next;
    area.focus();
    area.setSelectionRange(s, s + inner.length);
    area.dispatchEvent(new Event("input", { bubbles: true }));
    return next;
  }
  return insertWrap(area, marker, marker);
}

function apply(e: React.MouseEvent, fn: () => void) {
  e.preventDefault();
  e.stopPropagation();
  fn();
}

export function Editor({ noteId, tabId }: { noteId: number; tabId: string }) {
  const notes = useNotes((s) => s.notes);
  const archived = useNotes((s) => s.archived);
  const trashed = useNotes((s) => s.trashed);
  const categories = useNotes((s) => s.categories);
  const setCategory = useNotes((s) => s.setCategory);
  const togglePin = useNotes((s) => s.togglePin);
  const toggleFavorite = useNotes((s) => s.toggleFavorite);
  const toggleArchive = useNotes((s) => s.toggleArchive);
  const deleteNote = useNotes((s) => s.deleteNote);
  const renameTab = useTabs((s) => s.renameTab);
  const defaultEditorMode = useTheme((s) => s.editorMode);
  const toggleSidebar = useTheme((s) => s.toggleSidebar);

  const note =
    notes.find((n) => n.id === noteId) ??
    archived.find((n) => n.id === noteId) ??
    trashed.find((n) => n.id === noteId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>(defaultEditorMode);
  const [catMenu, setCatMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const pending = useRef<{ title: string; content: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const richRef = useRef<RichEditorHandle | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [noteId]);

  useEffect(() => {
    if (note) {
      renameTab(tabId, note.title || "Untitled", note.pinned);
    }
  }, [note?.title, note?.pinned, tabId]);

  useEffect(() => {
    if (!note) return;
    const n =
      notes.find((x) => x.id === noteId) ??
      archived.find((x) => x.id === noteId) ??
      trashed.find((x) => x.id === noteId);
    if (n && n.updated_at !== note.updated_at) {
      const active = document.activeElement;
      const inEditor =
        active === taRef.current ||
        active === richRef.current?.el ||
        active?.classList?.contains("editor-title-input");
      if (!inEditor) {
        setTitle(n.title);
        setContent(n.content);
      }
    }
  }, [notes, archived, trashed]);

  const queueSave = (t: string, c: string) => {
    pending.current = { title: t, content: c };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const p = pending.current;
      if (!p) return;
      setSaving(true);
      try {
        await api.updateNote(noteId, p.title, p.content, note?.category_id ?? null);
      } catch (e) {
        notify("error", "Failed to autosave", String(e));
      } finally {
        setSaving(false);
      }
    }, 700);
  };

  if (!note) {
    return (
      <div className="editor-wrap">
        <div className="empty-state" style={{ height: "100%" }}>
          <div className="empty-icon"><FileOutput size={24} /></div>
          <h3>Note not found</h3>
          <p>This note may have been deleted. Choose another note from the sidebar.</p>
        </div>
      </div>
    );
  }

  const stats = {
    words: wordCount(content),
    chars: charCount(content),
    readMin: Math.max(1, Math.round(wordCount(content) / 220)),
  };

  const exec = (fn: (area: HTMLTextAreaElement) => string | void) => {
    const area = taRef.current;
    if (!area) return;
    const next = fn(area);
    if (next !== undefined) {
      setContent(next);
      queueSave(title, next);
    }
  };

  const onContentChange = (v: string) => {
    let t = title;
    if (!t.trim()) {
      const line = firstLine(v);
      if (line) {
        t = line.slice(0, 80);
        setTitle(t);
      }
    }
    setContent(v);
    queueSave(t, v);
  };

  const onTitleChange = (v: string) => {
    setTitle(v);
    queueSave(v, content);
  };

  const duplicate = async () => {
    const copy = await useNotes.getState().createNote(`${note.title || "Untitled"} (copy)`, content, note.category_id);
    if (copy) useTabs.getState().openNote(copy.id, copy.title || "Untitled", false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "b" && mode === "edit") {
        e.preventDefault();
        exec((a) => insertInline(a, "**"));
      } else if (k === "i" && mode === "edit") {
        e.preventDefault();
        exec((a) => insertInline(a, "*"));
      } else if (k === "k" && mode === "edit") {
        e.preventDefault();
        exec((a) => insertInline(a, "[text](url)"));
      } else if ((e.key === "1" || e.key === "2") && mode === "edit") {
        e.preventDefault();
        exec((a) => insertLine(a, e.key === "1" ? "# " : "## ", "Heading"));
      } else if (k === "d" && e.shiftKey) {
        e.preventDefault();
        duplicate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [title, content, noteId, mode]);

  const copyMarkdown = async () => {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(content);
      await useNotes.getState().captureClipboard();
      notify("success", "Copied to clipboard", "Markdown source copied");
    } catch {
      notify("error", "Copy failed");
    }
  };

  const exportFile = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: `${(note.title || "note").replace(/[\\/:*?"<>|]/g, "_")}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) {
        await writeTextFile(path, content);
        notify("success", "Note exported", path);
      }
    } catch {
      notify("error", "Export failed");
    }
  };

  const richExec = (cmd: string, value?: string) => richRef.current?.exec(cmd, value);

  const richInsertLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (url) richExec("createLink", url);
  };

  const richTask = () => {
    richExec(
      "insertHTML",
      `<ul><li style="list-style:none"><input type="checkbox" style="margin-right:6px;accent-color:var(--accent)"> </li></ul>`
    );
  };

  const isRich = mode === "rich";

  return (
    <div
      className="editor-wrap"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setCatMenu(false);
          setMoreMenu(false);
        }
      }}
    >
      <div className="editor-header">
        <button className="icon-btn" title="Back" onClick={() => useTabs.getState().closeTab(tabId)}>
          <ArrowLeft size={15} />
        </button>
        <input
          className="editor-title-input"
          value={title}
          placeholder="Untitled"
          onChange={(e) => onTitleChange(e.target.value)}
          spellCheck={false}
        />

        <div className="seg">
          <button className={mode === "edit" ? "active" : ""} title="Write (Markdown)" onClick={() => setMode("edit")}>
            <Code2 size={13} />
          </button>
          <button className={mode === "rich" ? "active" : ""} title="Rich text" onClick={() => setMode("rich")}>
            <FileOutput size={13} />
          </button>
          <button className={mode === "split" ? "active" : ""} title="Split view" onClick={() => setMode("split")}>
            <CheckSquare size={13} />
          </button>
          <button className={mode === "preview" ? "active" : ""} title="Preview" onClick={() => setMode("preview")}>
            <Eye size={13} />
          </button>
        </div>

        <button className={`icon-btn ${note.pinned ? "active" : ""}`} title="Pin" onClick={() => togglePin(note.id)}>
          <Pin size={15} />
        </button>
        <button className={`icon-btn ${note.favorite ? "active" : ""}`} title="Favorite" onClick={() => toggleFavorite(note.id)}>
          <Star size={15} />
        </button>
        <button className="icon-btn" title="Tags" onClick={() => setTagModal(true)}>
          <Tag size={15} />
        </button>
        <button
          className="icon-btn"
          title="Focus mode"
          onClick={() => {
            toggleSidebar();
            useNotes.getState().toggleClipboardPanel(false);
          }}
        >
          <Focus size={15} />
        </button>

        <div style={{ position: "relative" }}>
          <button
            className="icon-btn"
            title="Category"
            onClick={(e) => {
              e.stopPropagation();
              setCatMenu((v) => !v);
              setMoreMenu(false);
            }}
          >
            <FolderBadge color={note.category_color} />
          </button>
          {catMenu && (
            <div className="menu-wrap" style={{ top: 30, right: 0 }} onMouseDown={(e) => e.stopPropagation()}>
              <button className="menu-item" onClick={() => { setCategory(note.id, null); setCatMenu(false); }}>
                <Archive size={14} /> No category
              </button>
              <div className="menu-sep" />
              {categories.map((c) => (
                <button
                  key={c.id}
                  className="menu-item"
                  onClick={() => { setCategory(note.id, c.id); setCatMenu(false); notify("success", "Category changed", c.name); }}
                >
                  <span className="category-dot" style={{ background: c.color }} /> {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            className="icon-btn"
            title="More actions"
            onClick={(e) => {
              e.stopPropagation();
              setMoreMenu((v) => !v);
              setCatMenu(false);
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          {moreMenu && (
            <div className="menu-wrap" style={{ top: 30, right: 0 }} onMouseDown={(e) => e.stopPropagation()}>
              <button className="menu-item" onClick={() => { duplicate(); setMoreMenu(false); }}>
                <Copy size={14} /> Duplicate Note
              </button>
              <button className="menu-item" onClick={() => { copyMarkdown(); setMoreMenu(false); }}>
                <ClipboardCopy size={14} /> Copy Markdown
              </button>
              <button className="menu-item" onClick={() => { exportFile(); setMoreMenu(false); }}>
                <Download size={14} /> Export .md file
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => { toggleArchive(note.id); setMoreMenu(false); }}>
                <Archive size={14} /> {note.archived ? "Unarchive" : "Archive"}
              </button>
              <button className="menu-item danger" onClick={() => { deleteNote(note.id); useTabs.getState().closeTab(tabId); }}>
                <Trash2 size={14} /> Move to Trash
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="editor-meta">
        <span>Updated {formatFull(note.updated_at)}</span>
        {stats.words >= 220 && <span>{stats.readMin} min read</span>}
        {note.category_name && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="category-dot" style={{ width: 7, height: 7, background: note.category_color ?? "var(--border-strong)" }} />
            {note.category_name}
          </span>
        )}
        {note.tags.map((t) => (
          <span key={t.id} className="tag-chip" style={{ color: t.color, background: `${t.color}1a` }}>
            {t.name}
          </span>
        ))}
        {saving && <span style={{ marginLeft: "auto" }}>Saving…</span>}
      </div>

      {(mode === "edit" || mode === "rich") && (
        <RichToolbar isRich={isRich} richExec={richExec} richInsertLink={richInsertLink} richTask={richTask} exec={exec} />
      )}

      <div className="editor-body">
        {mode === "edit" && (
          <div className="editor-pane">
            <textarea
              ref={taRef}
              className="editor-textarea"
              value={content}
              placeholder={"Write in Markdown…\n\n# Heading\n**bold**, *italic*, `code`\n- list item\n> quote\n\n⌘B bold · ⌘I italic · ⌘1/2 headings"}
              onChange={(e) => onContentChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
        {mode === "rich" && (
          <div className="editor-pane">
            <RichTextEditor ref={richRef} value={content} onChange={onContentChange} />
          </div>
        )}
        {(mode === "split" || mode === "preview") && (
          <>
            {mode === "split" && (
              <div className="editor-pane">
                <textarea
                  ref={taRef}
                  className="editor-textarea"
                  value={content}
                  placeholder={"Write in Markdown…"}
                  onChange={(e) => onContentChange(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
            {mode === "split" && <div className="pane-divider" />}
            <div className="preview-pane">
              {content.trim() ? (
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ color: "var(--text-3)" }}>Nothing to preview yet — start writing.</div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="statusbar">
        <span className="status-item">{stats.words} words</span>
        <span className="status-item">{stats.chars} chars</span>
        <span className="spacer" />
        <span className="status-item">{isRich ? "Rich Text" : "Markdown"}</span>
      </div>

      {tagModal && <TagPickerModal noteId={note.id} onClose={() => setTagModal(false)} />}
    </div>
  );
}

function FolderBadge({ color }: { color?: string | null }) {
  return (
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 4,
        background: color ?? "var(--border-strong)",
        display: "inline-block",
      }}
    />
  );
}

function ToolbarBtn({ icon, title, onMouseDown }: { icon: React.ReactNode; title: string; onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <button className="icon-btn" title={title} onMouseDown={onMouseDown}>
      {icon}
    </button>
  );
}

function RichToolbar({
  isRich,
  richExec,
  richInsertLink,
  richTask,
  exec,
}: {
  isRich: boolean;
  richExec: (cmd: string, value?: string) => void;
  richInsertLink: () => void;
  richTask: () => void;
  exec: (fn: (area: HTMLTextAreaElement) => string | void) => void;
}) {
  const r = (cmd: string, value?: string) => richExec(cmd, value);
  return (
    <div className="toolbar">
      {isRich ? (
        <>
          <ToolbarBtn icon={<Heading1 size={15} />} title="Heading 1" onMouseDown={(e) => apply(e, () => r("formatBlock", "h1"))} />
          <ToolbarBtn icon={<Heading2 size={15} />} title="Heading 2" onMouseDown={(e) => apply(e, () => r("formatBlock", "h2"))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Bold size={15} />} title="Bold (⌘B)" onMouseDown={(e) => apply(e, () => r("bold"))} />
          <ToolbarBtn icon={<Italic size={15} />} title="Italic (⌘I)" onMouseDown={(e) => apply(e, () => r("italic"))} />
          <ToolbarBtn icon={<Underline size={15} />} title="Underline (⌘U)" onMouseDown={(e) => apply(e, () => r("underline"))} />
          <ToolbarBtn icon={<Strikethrough size={15} />} title="Strikethrough" onMouseDown={(e) => apply(e, () => r("strikethrough"))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<List size={15} />} title="Bullet list" onMouseDown={(e) => apply(e, () => r("insertUnorderedList"))} />
          <ToolbarBtn icon={<ListOrdered size={15} />} title="Numbered list" onMouseDown={(e) => apply(e, () => r("insertOrderedList"))} />
          <ToolbarBtn icon={<CheckSquare size={15} />} title="Task list" onMouseDown={(e) => apply(e, () => richTask())} />
          <ToolbarBtn icon={<Quote size={15} />} title="Quote" onMouseDown={(e) => apply(e, () => r("formatBlock", "blockquote"))} />
          <ToolbarBtn icon={<Code2 size={15} />} title="Code block" onMouseDown={(e) => apply(e, () => r("formatBlock", "pre"))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Link2 size={15} />} title="Link" onMouseDown={(e) => apply(e, () => richInsertLink())} />
          <ToolbarBtn icon={<Undo2 size={15} />} title="Undo (⌘Z)" onMouseDown={(e) => apply(e, () => r("undo"))} />
          <ToolbarBtn icon={<Redo2 size={15} />} title="Redo (⌘⇧Z)" onMouseDown={(e) => apply(e, () => r("redo"))} />
        </>
      ) : (
        <>
          <ToolbarBtn icon={<Heading1 size={15} />} title="Heading 1 (⌘1)" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "# ", "Heading")))} />
          <ToolbarBtn icon={<Heading2 size={15} />} title="Heading 2 (⌘2)" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "## ", "Heading")))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Bold size={15} />} title="Bold (⌘B)" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "**")))} />
          <ToolbarBtn icon={<Italic size={15} />} title="Italic (⌘I)" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "*")))} />
          <ToolbarBtn icon={<Strikethrough size={15} />} title="Strikethrough" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "~~")))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<List size={15} />} title="Bullet list" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "- ", "item")))} />
          <ToolbarBtn icon={<ListOrdered size={15} />} title="Numbered list" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "1. ", "item")))} />
          <ToolbarBtn icon={<CheckSquare size={15} />} title="Task list" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "- [ ] ", "task")))} />
          <ToolbarBtn icon={<Quote size={15} />} title="Quote" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "> ", "quote")))} />
          <ToolbarBtn icon={<Code2 size={15} />} title="Code block" onMouseDown={(e) => apply(e, () => exec((a) => insertWrap(a, "```\n", "\n```")))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Link2 size={15} />} title="Link" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "[text](url)")))} />
          <ToolbarBtn icon={<Undo2 size={15} />} title="Undo (⌘Z)" onMouseDown={(e) => apply(e, () => exec((a) => { a.focus(); document.execCommand("undo"); }))} />
          <ToolbarBtn icon={<Redo2 size={15} />} title="Redo (⌘⇧Z)" onMouseDown={(e) => apply(e, () => exec((a) => { a.focus(); document.execCommand("redo"); }))} />
        </>
      )}
      <span className="spacer" />
      <span style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        {isRich ? <FileOutput size={11} /> : <Copy size={11} />}
        {isRich ? "Rich Text" : "Markdown"}
      </span>
    </div>
  );
}
