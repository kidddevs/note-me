import {
  Archive,
  ArrowLeft,
  Bold,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Code2,
  Columns2,
  Copy,
  Download,
  Eye,
  FileText,
  Focus,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  PenLine,
  Pin,
  Quote,
  Redo2,
  Search,
  Star,
  Strikethrough,
  Tag,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
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
import { NoteInspector } from "./NoteInspector";
import { duplicateNote, exportNoteMarkdown } from "../lib/actions";
import { playTrashSound } from "../lib/sounds";

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
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spellcheck = useTheme((st) => st.spellcheck);
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
    }, 600);
  };

  if (!note) {
    return (
      <div className="editor-wrap">
        <div className="empty-state" style={{ height: "100%" }}>
          <div className="empty-icon"><FileText size={24} /></div>
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
    if (note) await duplicateNote({ ...note, content });
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
      } else if (k === "i" && e.shiftKey) {
        e.preventDefault();
        setInspectorOpen((v) => !v);
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
      notify("success", "Markdown copied to clipboard");
    } catch {
      notify("error", "Copy failed");
    }
  };

  const exportFile = () => exportNoteMarkdown(note.title, content);

  const richExec = (cmd: string, value?: string) => richRef.current?.exec(cmd, value);

  // ---------- attachments ----------
  const insertAtCursor = async (file: File) => {
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const path = await api.saveAttachment([...buf], ext);
      const src = convertFileSrc(path);
      const md = `![image](${src})`;
      if (mode === "rich") {
        richExec("insertHTML", `<img src="${src}" alt="image" style="max-width:100%;border-radius:8px;"> `);
      } else {
        const area = taRef.current;
        if (!area) return;
        const pos = area.selectionStart ?? content.length;
        const next = content.slice(0, pos) + md + content.slice(pos);
        setContent(next);
        queueSave(title, next);
      }
      notify("success", "Image attached");
    } catch (e) {
      notify("error", "Could not attach image", String(e));
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          insertAtCursor(file);
        }
        return;
      }
    }
  };

  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])];
    for (const f of files) {
      if (f.type.startsWith("image/")) insertAtCursor(f);
    }
  };

  // ---------- find & replace ----------
  const flags = matchCase ? "g" : "gi";
  const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = findQuery ? [...content.matchAll(new RegExp(escaped, flags))] : [];
  const replaceCurrent = () => {
    if (!findQuery || matches.length === 0) return;
    const re = new RegExp(escaped, matchCase ? "" : "i");
    const next = content.replace(re, replaceQuery);
    setContent(next);
    queueSave(title, next);
  };
  const replaceAll = () => {
    if (!findQuery || matches.length === 0) return;
    const next = content.replace(new RegExp(escaped, flags), replaceQuery);
    setContent(next);
    queueSave(title, next);
    notify("success", `Replaced ${matches.length} ${matches.length === 1 ? "match" : "matches"}`);
  };
  const focusMatch = (dir: 1 | -1) => {
    const area = taRef.current;
    if (!area || matches.length === 0) return;
    const idxList = matches.map((m) => m.index ?? 0);
    const current = area.selectionStart;
    let target = dir === 1 ? idxList.find((i) => i > current) : [...idxList].reverse().find((i) => i < current);
    if (target === undefined) target = dir === 1 ? idxList[0] : idxList[idxList.length - 1];
    area.focus();
    area.setSelectionRange(target, target + findQuery.length);
    const beforeLines = content.slice(0, target).split("\n").length;
    area.scrollTop = Math.max(0, (beforeLines - 6) * 24.5);
  };

  const jumpToLine = (lineIndex: number) => {
    const area = taRef.current;
    if (area) {
      const lines = content.split("\n");
      const targetChar = lines.slice(0, lineIndex).join("\n").length + (lineIndex > 0 ? 1 : 0);
      area.focus();
      area.setSelectionRange(targetChar, targetChar);
      area.scrollTop = Math.max(0, (lineIndex - 4) * 24.5);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f" && (mode === "edit" || mode === "split")) {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 20);
      }
      if (e.key === "Escape" && findOpen) setFindOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, findOpen]);

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
      style={{ flex: 1, minHeight: 0, display: "flex", width: "100%" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setCatMenu(false);
          setMoreMenu(false);
        }
      }}
    >
      <div className="editor-wrap">
        <div className="editor-header">
          <button className="icon-btn" title="Back to Notes" onClick={() => useTabs.getState().closeTab(tabId)}>
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
              <PenLine size={13} />
            </button>
            <button className={mode === "rich" ? "active" : ""} title="Rich text" onClick={() => setMode("rich")}>
              <FileText size={13} />
            </button>
            <button className={mode === "split" ? "active" : ""} title="Split view" onClick={() => setMode("split")}>
              <Columns2 size={13} />
            </button>
            <button className={mode === "preview" ? "active" : ""} title="Preview" onClick={() => setMode("preview")}>
              <Eye size={13} />
            </button>
          </div>

          <button className={`icon-btn ${note.pinned ? "active" : ""}`} title={note.pinned ? "Unpin" : "Pin"} onClick={() => togglePin(note.id)}>
            <Pin size={15} color={note.pinned ? "var(--accent)" : "currentColor"} />
          </button>
          <button className={`icon-btn ${note.favorite ? "active" : ""}`} title={note.favorite ? "Unfavorite" : "Favorite"} onClick={() => toggleFavorite(note.id)}>
            <Star size={15} color={note.favorite ? "var(--warning)" : "currentColor"} />
          </button>
          <button className="icon-btn" title="Manage tags" onClick={() => setTagModal(true)}>
            <Tag size={15} />
          </button>
          <button
            className={`icon-btn ${inspectorOpen ? "active" : ""}`}
            title="Note Inspector & Outline (⌘⇧I)"
            onClick={() => setInspectorOpen((v) => !v)}
          >
            <Info size={15} />
          </button>
          <button
            className="icon-btn"
            title="Toggle focus mode"
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
              title="Set category"
              onClick={(e) => {
                e.stopPropagation();
                setCatMenu((v) => !v);
                setMoreMenu(false);
              }}
            >
              <FolderBadge color={note.category_color} />
            </button>
            {catMenu && (
              <div className="menu-wrap dropdown" style={{ top: 32, right: 0 }} onMouseDown={(e) => e.stopPropagation()}>
                <button className="menu-item" onClick={() => { setCategory(note.id, null); setCatMenu(false); }}>
                  <Archive size={14} /> No category
                </button>
                <div className="menu-sep" />
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className="menu-item"
                    onClick={() => { setCategory(note.id, c.id); setCatMenu(false); notify("success", "Category updated", c.name); }}
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
              <div className="menu-wrap dropdown" style={{ top: 32, right: 0 }} onMouseDown={(e) => e.stopPropagation()}>
                <button className="menu-item" onClick={() => { duplicate(); setMoreMenu(false); }}>
                  <Copy size={14} /> Duplicate Note
                </button>
                <button className="menu-item" onClick={() => { copyMarkdown(); setMoreMenu(false); }}>
                  <ClipboardCopy size={14} /> Copy Markdown
                </button>
                <button className="menu-item" onClick={() => { exportFile(); setMoreMenu(false); }}>
                  <Download size={14} /> Export .md File
                </button>
                <div className="menu-sep" />
                <button className="menu-item" onClick={() => { toggleArchive(note.id); setMoreMenu(false); }}>
                  <Archive size={14} /> {note.archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  className="menu-item danger"
                  onClick={() => {
                    playTrashSound();
                    deleteNote(note.id);
                    useTabs.getState().closeTab(tabId);
                  }}
                >
                  <Trash2 size={14} /> Move to Trash
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="editor-meta">
          <span>Edited {formatFull(note.updated_at)}</span>
          {stats.words >= 150 && <span>· {stats.readMin} min read</span>}
          {note.category_name && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
              <span className="category-dot" style={{ width: 7, height: 7, background: note.category_color ?? "var(--border-strong)" }} />
              {note.category_name}
            </span>
          )}
          {note.tags.map((t) => (
            <span key={t.id} className="tag-chip" style={{ color: t.color, background: `${t.color}18` }}>
              {t.name}
            </span>
          ))}
          {saving && <span style={{ marginLeft: "auto", color: "var(--accent)" }}>Saving…</span>}
        </div>

        {(mode === "edit" || mode === "rich") && (
          <RichToolbar
            isRich={isRich}
            richExec={richExec}
            richInsertLink={richInsertLink}
            richTask={richTask}
            exec={exec}
            onAttachImage={() => fileInputRef.current?.click()}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              insertAtCursor(file);
              e.target.value = "";
            }
          }}
        />

        {findOpen && mode !== "rich" && (
          <div className="findbar">
            <Search size={13} />
            <input
              ref={findInputRef}
              className="find-input"
              placeholder="Find in note…"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); focusMatch(e.shiftKey ? -1 : 1); }
                if (e.key === "Escape") setFindOpen(false);
              }}
              spellCheck={false}
            />
            <span className="find-count">{findQuery ? `${matches.length}` : ""}</span>
            <button className="icon-btn" style={{ width: 22, height: 22 }} title="Previous match (⇧↵)" onClick={() => focusMatch(-1)}>
              <ChevronUp size={13} />
            </button>
            <button className="icon-btn" style={{ width: 22, height: 22 }} title="Next match (↵)" onClick={() => focusMatch(1)}>
              <ChevronDown size={13} />
            </button>
            <span className="tbar-sep" />
            <input
              className="find-input"
              placeholder="Replace with…"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              spellCheck={false}
            />
            <button className="btn small" onClick={replaceCurrent} disabled={!matches.length}>Replace</button>
            <button className="btn small" onClick={replaceAll} disabled={!matches.length}>All</button>
            <label className="find-case">
              <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Aa
            </label>
            <button className="icon-btn" style={{ width: 22, height: 22 }} title="Close (Esc)" onClick={() => setFindOpen(false)}>
              <X size={13} />
            </button>
          </div>
        )}

        <div className="editor-body" onDragOver={(e) => e.preventDefault()} onDrop={mode !== "rich" ? onDropFiles : undefined}>
          {mode === "edit" && (
            <div className="editor-pane">
              <textarea
                ref={taRef}
                className="editor-textarea"
                value={content}
                placeholder={"Write in Markdown…\n\n# Heading\n**bold**, *italic*, `code`\n- list item\n- [ ] task\n> quote\n\n⌘B bold · ⌘I italic · ⌘1/2 headings"}
                onChange={(e) => onContentChange(e.target.value)}
                spellCheck={spellcheck}
                onPaste={onPaste}
                style={{ fontSize: "var(--editor-font-size)" }}
              />
            </div>
          )}
          {mode === "rich" && (
            <div className="editor-pane" onDragOver={(e) => e.preventDefault()} onDrop={onDropFiles}>
              <RichTextEditor ref={richRef} value={content} onChange={onContentChange} spellcheck={spellcheck} />
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
                    spellCheck={spellcheck}
                    onPaste={onPaste}
                    style={{ fontSize: "var(--editor-font-size)" }}
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
                  <div style={{ color: "var(--text-3)", padding: "10px 0" }}>Nothing to preview yet — start writing.</div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="statusbar">
          <span className="status-item">{stats.words} words</span>
          <span className="status-item">{stats.chars} chars</span>
          <span className="spacer" />
          <button
            style={{ color: "var(--text-3)", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            onClick={() => setInspectorOpen((v) => !v)}
            title="Toggle Note Inspector (⌘⇧I)"
          >
            <Info size={11} /> Inspector
          </button>
          <span style={{ color: "var(--border)" }}>|</span>
          <span className="status-item">{isRich ? "Rich Text" : "Markdown"}</span>
        </div>

        {tagModal && <TagPickerModal noteId={note.id} onClose={() => setTagModal(false)} />}
      </div>

      {inspectorOpen && (
        <NoteInspector
          note={note}
          content={content}
          onClose={() => setInspectorOpen(false)}
          onJumpToLine={jumpToLine}
        />
      )}
    </div>
  );
}

function FolderBadge({ color }: { color?: string | null }) {
  return (
    <span
      style={{
        width: 11,
        height: 11,
        borderRadius: 3,
        background: color ?? "var(--border-strong)",
        display: "inline-block",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
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
  onAttachImage,
}: {
  isRich: boolean;
  richExec: (cmd: string, value?: string) => void;
  richInsertLink: () => void;
  richTask: () => void;
  exec: (fn: (area: HTMLTextAreaElement) => string | void) => void;
  onAttachImage: () => void;
}) {
  const r = (cmd: string, value?: string) => richExec(cmd, value);
  return (
    <div className="toolbar">
      {isRich ? (
        <>
          <ToolbarBtn icon={<Heading1 size={14} />} title="Heading 1" onMouseDown={(e) => apply(e, () => r("formatBlock", "h1"))} />
          <ToolbarBtn icon={<Heading2 size={14} />} title="Heading 2" onMouseDown={(e) => apply(e, () => r("formatBlock", "h2"))} />
          <ToolbarBtn icon={<Heading3 size={14} />} title="Heading 3" onMouseDown={(e) => apply(e, () => r("formatBlock", "h3"))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Bold size={14} />} title="Bold (⌘B)" onMouseDown={(e) => apply(e, () => r("bold"))} />
          <ToolbarBtn icon={<Italic size={14} />} title="Italic (⌘I)" onMouseDown={(e) => apply(e, () => r("italic"))} />
          <ToolbarBtn icon={<Underline size={14} />} title="Underline (⌘U)" onMouseDown={(e) => apply(e, () => r("underline"))} />
          <ToolbarBtn icon={<Strikethrough size={14} />} title="Strikethrough" onMouseDown={(e) => apply(e, () => r("strikethrough"))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<List size={14} />} title="Bullet list" onMouseDown={(e) => apply(e, () => r("insertUnorderedList"))} />
          <ToolbarBtn icon={<ListOrdered size={14} />} title="Numbered list" onMouseDown={(e) => apply(e, () => r("insertOrderedList"))} />
          <ToolbarBtn icon={<CheckSquare size={14} />} title="Task list" onMouseDown={(e) => apply(e, () => richTask())} />
          <ToolbarBtn icon={<Quote size={14} />} title="Quote" onMouseDown={(e) => apply(e, () => r("formatBlock", "blockquote"))} />
          <ToolbarBtn icon={<Code2 size={14} />} title="Code block" onMouseDown={(e) => apply(e, () => r("formatBlock", "pre"))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Link2 size={14} />} title="Insert Link" onMouseDown={(e) => apply(e, () => richInsertLink())} />
          <ToolbarBtn icon={<ImageIcon size={14} />} title="Attach Image" onMouseDown={(e) => apply(e, () => onAttachImage())} />
          <ToolbarBtn icon={<Undo2 size={14} />} title="Undo (⌘Z)" onMouseDown={(e) => apply(e, () => r("undo"))} />
          <ToolbarBtn icon={<Redo2 size={14} />} title="Redo (⌘⇧Z)" onMouseDown={(e) => apply(e, () => r("redo"))} />
        </>
      ) : (
        <>
          <ToolbarBtn icon={<Heading1 size={14} />} title="Heading 1 (⌘1)" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "# ", "Heading")))} />
          <ToolbarBtn icon={<Heading2 size={14} />} title="Heading 2 (⌘2)" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "## ", "Heading")))} />
          <ToolbarBtn icon={<Heading3 size={14} />} title="Heading 3" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "### ", "Heading")))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Bold size={14} />} title="Bold (⌘B)" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "**")))} />
          <ToolbarBtn icon={<Italic size={14} />} title="Italic (⌘I)" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "*")))} />
          <ToolbarBtn icon={<Strikethrough size={14} />} title="Strikethrough" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "~~")))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<List size={14} />} title="Bullet list" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "- ", "item")))} />
          <ToolbarBtn icon={<ListOrdered size={14} />} title="Numbered list" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "1. ", "item")))} />
          <ToolbarBtn icon={<CheckSquare size={14} />} title="Task list" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "- [ ] ", "task")))} />
          <ToolbarBtn icon={<Quote size={14} />} title="Quote" onMouseDown={(e) => apply(e, () => exec((a) => insertLine(a, "> ", "quote")))} />
          <ToolbarBtn icon={<Code2 size={14} />} title="Code block" onMouseDown={(e) => apply(e, () => exec((a) => insertWrap(a, "```\n", "\n```")))} />
          <span className="tbar-sep" />
          <ToolbarBtn icon={<Link2 size={14} />} title="Insert Link" onMouseDown={(e) => apply(e, () => exec((a) => insertInline(a, "[text](url)")))} />
          <ToolbarBtn icon={<ImageIcon size={14} />} title="Attach Image" onMouseDown={(e) => apply(e, () => onAttachImage())} />
          <ToolbarBtn icon={<Undo2 size={14} />} title="Undo (⌘Z)" onMouseDown={(e) => apply(e, () => exec((a) => { a.focus(); document.execCommand("undo"); }))} />
          <ToolbarBtn icon={<Redo2 size={14} />} title="Redo (⌘⇧Z)" onMouseDown={(e) => apply(e, () => exec((a) => { a.focus(); document.execCommand("redo"); }))} />
        </>
      )}
      <span className="spacer" />
      <span style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        {isRich ? <FileText size={11} /> : <PenLine size={11} />}
        {isRich ? "Rich Text" : "Markdown"}
      </span>
    </div>
  );
}
