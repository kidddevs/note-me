import {
  Archive,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Hash,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
  const removeCategory = useNotes((s) => s.removeCategory);
  const addTag = useNotes((s) => s.addTag);
  const removeTag = useNotes((s) => s.removeTag);
  const openView = useTabs((s) => s.openView);
  const tasks = useNotes((s) => s.tasks);
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState<{ id: number; name: string; color: string; icon: string } | null>(null);
  const searchTimer = useRef<number | null>(null);
  const [openSections, setOpenSections] = useState({ categories: true, tags: true });
  const toggleSection = (key: "categories" | "tags") =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const openTaskCount = tasks.filter((t) => !t.done).length;

  const onSearchInput = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      if (q.trim()) {
        openView({ kind: "search", query: q.trim() }, `Search: ${q.trim()}`);
      }
    }, 350);
  };

  const select = (sel: SidebarSelection, title: string) => {
    setSelection(sel);
    openView(selToView(sel), title);
  };

  const selToView = (sel: SidebarSelection) => {
    switch (sel.kind) {
      case "category":
        return { kind: "category" as const, id: sel.id };
      case "tag":
        return { kind: "tag" as const, id: sel.id };
      case "favorites":
        return { kind: "favorites" as const };
      case "tasks":
        return { kind: "tasks" as const };
      case "archived":
        return { kind: "archived" as const };
      case "trash":
        return { kind: "trash" as const };
      default:
        return { kind: "all" as const };
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-search">
        <div className="search-box">
          <Search size={13} style={{ flexShrink: 0 }} />
          <input
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => onSearchInput(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button
              className="icon-btn"
              style={{ width: 18, height: 18 }}
              title="Clear search"
              onClick={() => setSearchQuery("")}
            >
              <X size={11} />
            </button>
          )}
          <kbd>⌘K</kbd>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="nav-section">Library</div>
        <button
          className={`nav-item ${selection.kind === "all" ? "active" : ""}`}
          onClick={() => select({ kind: "all" }, "All Notes")}
        >
          <span className="nav-icon">
            <Inbox size={15} />
          </span>
          <span className="nav-label">All Notes</span>
          <span className="nav-count">{stats.total_notes}</span>
        </button>
        <button
          className={`nav-item ${selection.kind === "favorites" ? "active" : ""}`}
          onClick={() => select({ kind: "favorites" }, "Favorites")}
        >
          <span className="nav-icon fav">
            <Star size={15} />
          </span>
          <span className="nav-label">Favorites</span>
          {stats.favorites > 0 && <span className="nav-count">{stats.favorites}</span>}
        </button>
        <button
          className={`nav-item ${selection.kind === "tasks" ? "active" : ""}`}
          onClick={() => select({ kind: "tasks" }, "Tasks")}
        >
          <span className="nav-icon tasks">
            <ListChecks size={15} />
          </span>
          <span className="nav-label">Tasks</span>
          {openTaskCount > 0 && <span className="nav-count">{openTaskCount}</span>}
        </button>
        <button
          className={`nav-item ${selection.kind === "archived" ? "active" : ""}`}
          onClick={() => select({ kind: "archived" }, "Archive")}
        >
          <span className="nav-icon archive">
            <Archive size={15} />
          </span>
          <span className="nav-label">Archive</span>
        </button>
        <button
          className={`nav-item ${selection.kind === "trash" ? "active" : ""}`}
          onClick={() => select({ kind: "trash" }, "Trash")}
        >
          <span className="nav-icon trash">
            <Trash2 size={15} />
          </span>
          <span className="nav-label">Trash</span>
          {stats.trashed > 0 && <span className="nav-count">{stats.trashed}</span>}
        </button>

        <SectionHeader
          label="Categories"
          action={
            <button
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              title="New category"
              onClick={() => {
                setEditCat(null);
                setCatModal(true);
              }}
            >
              <FolderPlus size={13} />
            </button>
          }
          open={openSections.categories}
          onToggle={() => toggleSection("categories")}
        />
        {openSections.categories && (
          <>
            {categories.length === 0 && (
              <div style={{ padding: "4px 10px", color: "var(--text-3)", fontSize: 11.5 }}>
                No categories yet
              </div>
            )}
            {categories.map((c) => (
              <button
                key={c.id}
                className={`nav-item ${selection.kind === "category" && selection.id === c.id ? "active" : ""}`}
                onClick={() => select({ kind: "category", id: c.id }, c.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Delete category "${c.name}"? Notes inside will not be deleted.`)) {
                    removeCategory(c.id);
                  }
                }}
              >
                <span className="category-dot" style={{ background: c.color }} />
                <span className="nav-label">{c.name}</span>
                <span className="nav-count">{c.note_count}</span>
              </button>
            ))}
          </>
        )}

        <SectionHeader
          label="Tags"
          paddingTop={18}
          action={
            <button
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              title="New tag"
              onClick={() => {
                const name = window.prompt("Tag name") ?? "";
                if (name.trim()) addTag(name.trim(), "#0071e3");
              }}
            >
              <Plus size={13} />
            </button>
          }
          open={openSections.tags}
          onToggle={() => toggleSection("tags")}
        />
        {openSections.tags && (
          <>
            {tags.length === 0 && (
              <div style={{ padding: "4px 10px", color: "var(--text-3)", fontSize: 11.5 }}>
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
                <span className="nav-icon" style={{ color: t.color }}>
                  <Hash size={13} />
                </span>
                <span className="nav-label">{t.name}</span>
                <span className="nav-count">{t.note_count}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <span>{stats.total_notes} {stats.total_notes === 1 ? "note" : "notes"}</span>
        <button
          className="icon-btn"
          style={{ width: 22, height: 22 }}
          title="Preferences (⌘,)"
          onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
        >
          <Settings size={13} />
        </button>
      </div>

      {catModal && (
        <CategoryModal
          initial={editCat ?? undefined}
          onClose={() => {
            setCatModal(false);
            setEditCat(null);
          }}
          onCreate={async (name, color, icon) => {
            await addCategory(name, color, icon);
            setCatModal(false);
            setEditCat(null);
            notify("success", "Category created", name);
          }}
        />
      )}
    </aside>
  );
}

function SectionHeader({
  label,
  action,
  open,
  onToggle,
  paddingTop,
}: {
  label: string;
  action?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  paddingTop?: number;
}) {
  return (
    <div className="nav-section" style={{ paddingTop: paddingTop ?? 14 }}>
      <button className="section-toggle" onClick={onToggle}>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {label}
      </button>
      {action}
    </div>
  );
}
