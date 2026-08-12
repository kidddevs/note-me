import { Archive, FolderPlus, Hash, Inbox, Search, Star, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useNotes } from "../store/notes";
import { useTabs } from "../store/tabs";
import type { SidebarSelection } from "../lib/types";
import { CategoryModal } from "./Modals";
import { notify } from "../store/toast";


export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const selection = useNotes((s) => s.selection);
  const setSelection = useNotes((s) => s.setSelection);
  const searchQuery = useNotes((s) => s.searchQuery);
  const setSearchQuery = useNotes((s) => s.setSearchQuery);
  const categories = useNotes((s) => s.categories);
  const tags = useNotes((s) => s.tags);
  const stats = useNotes((s) => s.stats);
  const addCategory = useNotes((s) => s.addCategory);
  const addTag = useNotes((s) => s.addTag);
  const removeTag = useNotes((s) => s.removeTag);
  const openView = useTabs((s) => s.openView);
  const [catModal, setCatModal] = useState(false);
  const searchTimer = useRef<number | null>(null);

  const onSearchInput = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      if (q.trim()) {
        openView({ kind: "search", query: q.trim() }, `Search: ${q.trim()}`);
      }
    }, 450);
  };

  const select = (sel: SidebarSelection, title: string) => {
    setSelection(sel);
    openView(selToView(sel), title);
  };

  const selToView = (sel: SidebarSelection) => {
    switch (sel.kind) {
      case "category": return { kind: "category" as const, id: sel.id };
      case "tag": return { kind: "tag" as const, id: sel.id };
      case "favorites": return { kind: "favorites" as const };
      case "archived": return { kind: "archived" as const };
      case "trash": return { kind: "trash" as const };
      default: return { kind: "all" as const };
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-search">
        <div className="search-box">
          <Search size={13} />
          <input
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => onSearchInput(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setSearchQuery("")}>
              <X size={12} />
            </button>
          )}
          <kbd>⌘K</kbd>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="nav-section">Library</div>
        <button className={`nav-item ${selection.kind === "all" ? "active" : ""}`} onClick={() => select({ kind: "all" }, "All Notes")}>
          <span className="nav-icon"><Inbox size={15} /></span>
          <span className="nav-label">All Notes</span>
          <span className="nav-count">{stats.total_notes}</span>
        </button>
        <button className={`nav-item ${selection.kind === "favorites" ? "active" : ""}`} onClick={() => select({ kind: "favorites" }, "Favorites")}>
          <span className="nav-icon"><Star size={15} /></span>
          <span className="nav-label">Favorites</span>
          <span className="nav-count">{stats.favorites}</span>
        </button>
        <button className={`nav-item ${selection.kind === "archived" ? "active" : ""}`} onClick={() => select({ kind: "archived" }, "Archive")}>
          <span className="nav-icon"><Archive size={15} /></span>
          <span className="nav-label">Archive</span>
        </button>
        <button className={`nav-item ${selection.kind === "trash" ? "active" : ""}`} onClick={() => select({ kind: "trash" }, "Trash")}>
          <span className="nav-icon"><Trash2 size={15} /></span>
          <span className="nav-label">Trash</span>
          <span className="nav-count">{stats.trashed}</span>
        </button>

        <div className="nav-section" style={{ paddingTop: 18 }}>
          Categories
          <button className="icon-btn" style={{ width: 20, height: 20 }} title="New category" onClick={() => setCatModal(true)}>
            <FolderPlus size={13} />
          </button>
        </div>
        {categories.length === 0 && (
          <div style={{ padding: "2px 10px", color: "var(--text-3)", fontSize: 11.5 }}>
            No categories yet
          </div>
        )}
        {categories.map((c) => (
          <button
            key={c.id}
            className={`nav-item ${selection.kind === "category" && selection.id === c.id ? "active" : ""}`}
            onClick={() => select({ kind: "category", id: c.id }, c.name)}
          >
            <span className="category-dot" style={{ background: c.color }} />
            <span className="nav-label">{c.name}</span>
            <span className="nav-count">{c.note_count}</span>
          </button>
        ))}

        <div className="nav-section" style={{ paddingTop: 18 }}>
          Tags
          <button
            className="icon-btn"
            style={{ width: 20, height: 20 }}
            title="New tag"
            onClick={() => {
              const name = window.prompt("Tag name") ?? "";
              if (name.trim()) addTag(name.trim(), "#64748b");
            }}
          >
            <Hash size={13} />
          </button>
        </div>
        {tags.length === 0 && (
          <div style={{ padding: "2px 10px", color: "var(--text-3)", fontSize: 11.5 }}>
            No tags yet
          </div>
        )}
        {tags.map((t) => (
          <button
            key={t.id}
            className={`nav-item ${selection.kind === "tag" && selection.id === t.id ? "active" : ""}`}
            onClick={() => select({ kind: "tag", id: t.id }, t.name)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (window.confirm(`Delete tag "${t.name}"?`)) removeTag(t.id);
            }}
          >
            <span className="category-dot" style={{ background: t.color }} />
            <span className="nav-label">{t.name}</span>
            <span className="nav-count">{t.note_count}</span>
          </button>
        ))}
      </div>

      {catModal && (
        <CategoryModal
          onClose={() => setCatModal(false)}
          onCreate={async (name, color, icon) => {
            await addCategory(name, color, icon);
            setCatModal(false);
            notify("success", "Category created", name);
          }}
        />
      )}
    </aside>
  );
}
