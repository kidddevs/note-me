import {
  CalendarDays,
  CheckSquare,
  ClipboardPaste,
  Download,
  FilePlus2,
  Hash,
  Inbox,
  NotebookPen,
  Printer,
  Search,
  Settings,
  Star,
  StickyNote,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotes, openNoteInTab } from "../store/notes";
import { useTabs } from "../store/tabs";
import { excerpt } from "../lib/format";
import { createFromTemplate, importFilesAsNotes } from "../lib/actions";

interface Item {
  id: string;
  label: string;
  sub?: string;
  category?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function Palette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const notes = useNotes((s) => s.notes);
  const categories = useNotes((s) => s.categories);
  const tags = useNotes((s) => s.tags);
  const createNote = useNotes((s) => s.createNote);
  const openView = useTabs((s) => s.openView);

  useEffect(() => {
    const openPalette = () => {
      setQuery("");
      setIdx(0);
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 25);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("open-palette", openPalette);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-palette", openPalette);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const list: Item[] = [];
    if (!q) {
      list.push({
        id: "new",
        category: "Actions",
        label: "New note",
        sub: "⌘N",
        icon: <FilePlus2 size={15} color="var(--accent)" />,
        action: () => createNote().then((n) => n && openNoteInTab(n)),
      });
      list.push({
        id: "daily",
        category: "Templates",
        label: "New daily note",
        sub: "Template",
        icon: <CalendarDays size={15} color="var(--indigo)" />,
        action: () => createFromTemplate("daily"),
      });
      list.push({
        id: "meeting",
        category: "Templates",
        label: "New meeting notes",
        sub: "Template",
        icon: <StickyNote size={15} color="var(--teal)" />,
        action: () => createFromTemplate("meeting"),
      });
      list.push({
        id: "journal",
        category: "Templates",
        label: "New journal entry",
        sub: "Template",
        icon: <NotebookPen size={15} color="var(--purple)" />,
        action: () => createFromTemplate("journal"),
      });
      list.push({
        id: "import",
        category: "Actions",
        label: "Import .md / .txt files…",
        sub: "Import",
        icon: <Download size={15} />,
        action: () => importFilesAsNotes(),
      });
      list.push({
        id: "clipnote",
        category: "Actions",
        label: "New note from clipboard",
        sub: "Clipboard",
        icon: <ClipboardPaste size={15} />,
        action: async () => {
          try {
            const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
            const text = await readText();
            if (text?.trim()) {
              const first =
                text.split("\n").find((l) => l.trim())?.slice(0, 60) ??
                "From clipboard";
              const n = await createNote(first, text);
              if (n) openNoteInTab(n);
            }
          } catch {
            // clipboard unavailable
          }
        },
      });
      list.push({
        id: "tasks",
        category: "Views",
        label: "Tasks",
        sub: `${useNotes.getState().tasks.filter((t) => !t.done).length} open`,
        icon: <CheckSquare size={15} color="var(--indigo)" />,
        action: () => openView({ kind: "tasks" }, "Tasks"),
      });
      list.push({
        id: "all",
        category: "Views",
        label: "All Notes",
        sub: `${notes.length} notes`,
        icon: <Inbox size={15} color="var(--accent)" />,
        action: () => openView({ kind: "all" }, "All Notes"),
      });
      list.push({
        id: "fav",
        category: "Views",
        label: "Favorites",
        sub: "Favorites",
        icon: <Star size={15} color="var(--warning)" />,
        action: () => openView({ kind: "favorites" }, "Favorites"),
      });
      for (const c of categories) {
        list.push({
          id: `cat-${c.id}`,
          category: "Categories",
          label: c.name,
          sub: `${c.note_count} notes`,
           icon: <Hash size={15} color="var(--accent)" />,
          action: () => openView({ kind: "category", id: c.id }, c.name),
        });
      }
      list.push({
        id: "settings",
        category: "Preferences",
        label: "Preferences…",
        sub: "⌘,",
        icon: <Settings size={15} />,
        action: () => window.dispatchEvent(new CustomEvent("open-settings")),
      });
      list.push({
        id: "print",
        category: "Actions",
        label: "Print note…",
        sub: "⌘P",
        icon: <Printer size={15} />,
        action: () => window.print(),
      });
      return list;
    }

    const noteHits = notes
      .filter((n) => (n.title + " " + n.content).toLowerCase().includes(q))
      .slice(0, 10);

    list.push(
      ...noteHits.map((n) => ({
        id: `n-${n.id}`,
        category: "Notes",
        label: n.title || "Untitled",
        sub: excerpt(n.content, 60),
        icon: n.pinned ? (
          <Star size={15} color="var(--warning)" />
        ) : (
          <StickyNote size={15} color="var(--accent)" />
        ),
        action: () => openNoteInTab(n),
      }))
    );

    if (list.length === 0) {
      list.push({
        id: "none",
        label: "No matching notes",
        sub: "Press ⌘N to create a new note",
        icon: <Search size={15} />,
        action: () => {},
      });
    }
    return list;
  }, [query, notes, categories, tags.length]);

  useEffect(() => {
    if (idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  useEffect(() => {
    const activeEl = listRef.current?.children[idx] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [idx]);

  if (!open) return null;

  const run = (item: Item) => {
    item.action();
    setOpen(false);
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{ alignItems: "flex-start", paddingTop: "10vh" }}
    >
      <div className="palette">
        <div className="palette-input">
          <Search size={16} color="var(--text-3)" />
          <input
            ref={inputRef}
            placeholder="Type a command or search notes…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(i + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && items[idx]) {
                e.preventDefault();
                run(items[idx]);
              }
            }}
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.map((item, i) => (
            <button
              key={item.id}
              className={`palette-item ${i === idx ? "active" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(item)}
            >
              <span
                style={{
                  display: "flex",
                  width: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <span className="palette-label">{item.label}</span>
              {item.sub && <span className="palette-sub">{item.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
