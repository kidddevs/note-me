import { FilePlus2, Inbox, Search, Star, StickyNote } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotes, openNoteInTab } from "../store/notes";
import { useTabs } from "../store/tabs";
import { excerpt } from "../lib/format";

interface Item {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  action: () => void;
}

export function Palette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
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
      setTimeout(() => inputRef.current?.focus(), 20);
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
        label: "New note",
        sub: "⌘N",
        icon: <FilePlus2 size={15} />,
        action: () => createNote().then((n) => n && openNoteInTab(n)),
      });
      list.push({
        id: "all",
        label: "All Notes",
        sub: `${notes.length} notes`,
        icon: <Inbox size={15} />,
        action: () => openView({ kind: "all" }, "All Notes"),
      });
      list.push({
        id: "fav",
        label: "Favorites",
        sub: "",
        icon: <Star size={15} />,
        action: () => openView({ kind: "favorites" }, "Favorites"),
      });
      for (const c of categories) {
        list.push({
          id: `cat-${c.id}`,
          label: c.name,
          sub: `${c.note_count} notes`,
          icon: <span className="category-dot" style={{ background: c.color }} />,
          action: () => openView({ kind: "category", id: c.id }, c.name),
        });
      }
      return list;
    }
    const noteHits = notes.filter((n) => (n.title + " " + n.content).toLowerCase().includes(q)).slice(0, 8);
    list.push(...noteHits.map((n) => ({
      id: `n-${n.id}`,
      label: n.title || "Untitled",
      sub: excerpt(n.content, 60),
      icon: n.pinned ? <Star size={15} /> : <StickyNote size={15} />,
      action: () => openNoteInTab(n),
    })));
    if (list.length === 0) {
      list.push({
        id: "none",
        label: "No notes match",
        sub: "Press ⌘N to create one",
        icon: <Search size={15} />,
        action: () => {},
      });
    }
    return list;
  }, [query, notes, categories, tags.length]);

  useEffect(() => {
    if (idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  if (!open) return null;

  const run = (item: Item) => {
    item.action();
    setOpen(false);
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} style={{ alignItems: "flex-start", paddingTop: "11vh" }}>
      <div className="palette">
        <div className="palette-input">
          <Search size={16} />
          <input
            ref={inputRef}
            placeholder="Search notes and jump anywhere…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && items[idx]) { e.preventDefault(); run(items[idx]); }
            }}
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list">
          {items.map((item, i) => (
            <button
              key={item.id}
              className={`palette-item ${i === idx ? "active" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(item)}
            >
              <span style={{ display: "flex", width: 18, justifyContent: "center" }}>{item.icon}</span>
              <span className="palette-label">{item.label}</span>
              {item.sub && <span className="palette-sub">{item.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
