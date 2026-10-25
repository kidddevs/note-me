import { create } from "zustand";
import {
  BookOpen,
  BookPlus,
  Check,
  Clipboard,
  FilePlus2,
  Library,
  Minus,
  Monitor,
  Moon,
  PanelLeft,
  Pin,
  Plus,
  Search,
  Settings,
  Square,
  StickyNote,
  Sun,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTabs } from "../store/tabs";
import { useBookTabs, type BookTab } from "../store/bookTabs";
import { useBooks } from "../store/books";
import { useTheme } from "../store/theme";
import { useNotes } from "../store/notes";
import { useWorkspace, type WorkspaceMode } from "../store/workspace";
import { notify } from "../store/toast";
import { createNewBook } from "../lib/actions";
import type { Tab } from "../lib/types";
import { useEffect, useRef, useState } from "react";

export const isMac =
  navigator.userAgent.includes("Macintosh") ||
  navigator.platform?.toLowerCase().includes("mac");

interface MenuState {
  x: number;
  y: number;
  tabId: string;
  source: WorkspaceMode;
}

interface TabMenuState {
  menu: MenuState | null;
  drag: { id: string; source: WorkspaceMode } | null;
  setMenu: (m: MenuState | null) => void;
  setDrag: (d: { id: string; source: WorkspaceMode } | null) => void;
  dropOn: (targetId: string) => void;
}

const useTabMenu = create<TabMenuState>((set) => ({
  menu: null,
  drag: null,
  setMenu: (menu) => set({ menu }),
  setDrag: (drag) => set({ drag }),
  dropOn: (targetId) => {
    const { drag } = useTabMenu.getState();
    if (!drag) return;
    const store = drag.source === "notes" ? useTabs.getState() : useBookTabs.getState();
    const from = store.tabs.findIndex((t) => t.id === drag.id);
    const to = store.tabs.findIndex((t) => t.id === targetId);
    if (from !== -1 && to !== -1 && from !== to) {
      store.moveTab(from, to);
      store.activate(drag.id);
    }
    set({ drag: null });
  },
}));

interface TabButtonProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  active: boolean;
  source: WorkspaceMode;
  onActivate: () => void;
  onClose: () => void;
}

function TabButton({ id, title, icon, active, source, onActivate, onClose }: TabButtonProps) {
  const setMenu = useTabMenu((s) => s.setMenu);
  const dragging = useTabMenu((s) => s.drag?.id === id);

  return (
    <div
      className={`tab ${active ? "active" : ""} ${dragging ? "tab-drag" : ""}`}
      onClick={onActivate}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, tabId: id, source });
      }}
      draggable
      onDragStart={(e) => {
        useTabMenu.getState().setDrag({ id, source });
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => useTabMenu.getState().setDrag(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (useTabMenu.getState().drag?.source === source) useTabMenu.getState().dropOn(id);
      }}
      title={title}
    >
      {icon}
      <span className="tab-title">{title}</span>
      <button
        className="tab-close"
        title="Close tab (⌘W)"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function NoteTab({ tab }: { tab: Tab }) {
  const activate = useTabs((s) => s.activate);
  const closeTab = useTabs((s) => s.closeTab);
  const active = useTabs((s) => s.activeId === tab.id);

  return (
    <TabButton
      id={tab.id}
      title={tab.title}
      active={active}
      source="notes"
      icon={
        tab.kind === "note" ? (
          tab.pinned ? (
            <Pin size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
          ) : (
            <StickyNote size={12} style={{ flexShrink: 0, opacity: 0.75 }} />
          )
        ) : (
          <Search size={12} style={{ flexShrink: 0, opacity: 0.75 }} />
        )
      }
      onActivate={() => activate(tab.id)}
      onClose={() => closeTab(tab.id)}
    />
  );
}

function BookTabComponent({ tab }: { tab: BookTab }) {
  const activate = useBookTabs((s) => s.activate);
  const closeTab = useBookTabs((s) => s.closeTab);
  const active = useBookTabs((s) => s.activeId === tab.id);

  return (
    <TabButton
      id={tab.id}
      title={tab.title}
      active={active}
      source="books"
      icon={
        tab.kind === "library" ? (
          <Library size={12} style={{ flexShrink: 0, opacity: 0.75 }} />
        ) : (
          <BookOpen size={12} style={{ flexShrink: 0, opacity: 0.75 }} />
        )
      }
      onActivate={() => activate(tab.id)}
      onClose={() => closeTab(tab.id)}
    />
  );
}

export function TabContextMenu() {
  const menu = useTabMenu((s) => s.menu);
  const setMenu = useTabMenu((s) => s.setMenu);
  if (!menu) return null;
  const store = menu.source === "notes" ? useTabs.getState() : useBookTabs.getState();
  return (
    <div
      className="menu-wrap"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="menu-item"
        onClick={() => {
          store.closeTab(menu.tabId);
          setMenu(null);
        }}
      >
        <X size={13} /> Close Tab
      </button>
      <button
        className="menu-item"
        onClick={() => {
          store.closeOtherTabs(menu.tabId);
          setMenu(null);
        }}
      >
        <Check size={13} /> Close Other Tabs
      </button>
      <div className="menu-sep" />
      <button
        className="menu-item danger"
        onClick={() => {
          store.closeAllTabs();
          setMenu(null);
        }}
      >
        <X size={13} /> Close All Tabs
      </button>
    </div>
  );
}

export function TitleBar() {
  const tabs = useTabs((s) => s.tabs);
  const openHome = useTabs((s) => s.openHome);
  const bookTabs = useBookTabs((s) => s.tabs);
  const books = useBooks((s) => s.books);
  const theme = useTheme((s) => s.theme);
  const cycleTheme = useTheme((s) => s.cycleTheme);
  const toggleSidebar = useTheme((s) => s.toggleSidebar);
  const toggleClipboardPanel = useNotes((s) => s.toggleClipboardPanel);
  const createNote = useNotes((s) => s.createNote);
  const notes = useNotes((s) => s.notes);
  const workspace = useWorkspace((s) => s.mode);
  const toggleWorkspace = useWorkspace((s) => s.toggle);
  const booksSidebarCollapsed = useWorkspace((s) => s.booksSidebarCollapsed);
  const toggleBooksSidebar = useWorkspace((s) => s.toggleBooksSidebar);
  const [maximized, setMaximized] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const un = win.onResized(() => win.isMaximized().then(setMaximized));
    return () => {
      un.then((f) => f());
    };
  }, []);

  const newNote = async () => {
    const note = await createNote();
    if (note) {
      useTabs.getState().openNote(note.id, note.title || "Untitled", false);
      notify("success", "New note created", note.title || "Untitled");
    }
  };

  const newBook = async () => {
    if (creatingBook) return;
    setCreatingBook(true);
    try {
      await createNewBook();
    } catch (error) {
      notify("error", "Manuscript could not be created", String(error));
    } finally {
      setCreatingBook(false);
    }
  };

  useEffect(() => {
    if (workspace !== "books") return;
    if (useBookTabs.getState().tabs.length === 0) useBookTabs.getState().openLibrary();
  }, [workspace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "t") {
        e.preventDefault();
        if (workspace === "notes") openHome();
        else useBookTabs.getState().openLibrary();
      } else if (k === "n") {
        e.preventDefault();
        if (workspace === "notes") void newNote();
        else void newBook();
      } else if (k === "w") {
        if (workspace === "notes") {
          if (tabs.length === 0) return;
          e.preventDefault();
          useTabs.getState().closeTab(useTabs.getState().activeId ?? "");
        } else {
          if (useBookTabs.getState().tabs.length === 0) return;
          e.preventDefault();
          useBookTabs.getState().closeTab(useBookTabs.getState().activeId ?? "");
        }
      } else if (k === "tab") {
        e.preventDefault();
        if (workspace === "notes") useTabs.getState().activateRelative(e.shiftKey ? -1 : 1);
        else useBookTabs.getState().activateRelative(e.shiftKey ? -1 : 1);
      } else if (e.key === "]" && e.shiftKey) {
        e.preventDefault();
        if (workspace === "notes") useTabs.getState().activateRelative(1);
        else useBookTabs.getState().activateRelative(1);
      } else if (e.key === "[" && e.shiftKey) {
        e.preventDefault();
        if (workspace === "notes") useTabs.getState().activateRelative(-1);
        else useBookTabs.getState().activateRelative(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs.length, workspace, creatingBook]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const s = useTabs.getState();
    for (const t of s.tabs) {
      if (t.kind === "note") {
        const n = notes.find((x) => x.id === t.noteId);
        if (n && n.title !== t.title)
          s.renameTab(t.id, n.title || "Untitled", n.pinned);
      }
    }
  }, [notes]);

  useEffect(() => {
    const s = useBookTabs.getState();
    for (const t of s.tabs) {
      if (t.kind !== "book" || t.bookId == null) continue;
      const book = books.find((item) => item.id === t.bookId);
      if (book && book.title !== t.title) s.renameBook(t.bookId, book.title || "Untitled manuscript");
    }
  }, [books]);

  const win = getCurrentWindow();

  return (
    <header
      className={`titlebar ${isMac ? "titlebar-mac" : "titlebar-win"}`}
      data-tauri-drag-region
      onDoubleClick={(e) => {
        if (!isMac && e.target === e.currentTarget) win.toggleMaximize();
      }}
    >
      <div className="titlebar-left" data-tauri-drag-region>
        <button
          className="icon-btn workspace-switcher"
          title={workspace === "notes" ? "Switch to Books Studio" : "Switch to Notes"}
          aria-label={workspace === "notes" ? "Switch to Books Studio" : "Switch to Notes"}
          onClick={toggleWorkspace}
        >
          {workspace === "notes" ? <BookOpen size={15} /> : <StickyNote size={15} />}
        </button>
        {workspace === "notes" ? (
          <button
            className="icon-btn"
            title="New Note (⌘N)"
            aria-label="New note"
            onClick={newNote}
          >
            <FilePlus2 size={15} />
          </button>
        ) : (
          <button
            className="icon-btn"
            title="New Book (⌘N)"
            aria-label="New book"
            onClick={() => void newBook()}
            disabled={creatingBook}
          >
            <BookPlus size={15} />
          </button>
        )}
      </div>

      <div
        className="tab-strip"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 1 && e.target === e.currentTarget) {
            e.preventDefault();
            if (workspace === "notes") openHome();
            else useBookTabs.getState().openLibrary();
          }
        }}
      >
        {workspace === "notes" ? (
          tabs.map((t) => <NoteTab key={t.id} tab={t} />)
        ) : (
          bookTabs.map((t) => <BookTabComponent key={t.id} tab={t} />)
        )}
        <button
          className="tab-new"
          title="New Tab (⌘T)"
          aria-label="New tab"
          onClick={() => {
            if (workspace === "notes") openHome();
            else useBookTabs.getState().openLibrary();
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="win-controls" data-tauri-drag-region>
        <button
          className="icon-btn"
          title={`Appearance: ${theme} (⌘⇧T)`}
          aria-label={`Change appearance. Current theme: ${theme}`}
          onClick={cycleTheme}
        >
          {theme === "dark" ? (
            <Moon size={14} />
          ) : theme === "light" ? (
            <Sun size={14} />
          ) : (
            <Monitor size={14} />
          )}
        </button>
        <button
          className="icon-btn"
          title={workspace === "notes" ? "Command Palette (⌘K)" : "Books command palette (⌘K)"}
          aria-label={workspace === "notes" ? "Open command palette" : "Open Books Studio command palette"}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(workspace === "notes" ? "open-palette" : "open-books-palette")
            )
          }
        >
          <Search size={14} />
        </button>
        <button
          className="icon-btn"
          title="Preferences (⌘,)"
          aria-label="Open preferences"
          onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
        >
          <Settings size={14} />
        </button>
        <button
          className="icon-btn"
          title="Clipboard History (⌘⇧V)"
          aria-label="Clipboard history"
          onClick={() => toggleClipboardPanel()}
        >
          <Clipboard size={14} />
        </button>
        <button
          className="icon-btn"
          title={
            workspace === "notes"
              ? "Toggle Sidebar (⌘⌃S)"
              : booksSidebarCollapsed
                ? "Show Books sidebar"
                : "Hide Books sidebar"
          }
          aria-label={
            workspace === "notes"
              ? "Toggle sidebar"
              : booksSidebarCollapsed
                ? "Show Books sidebar"
                : "Hide Books sidebar"
          }
          onClick={workspace === "notes" ? toggleSidebar : toggleBooksSidebar}
        >
          <PanelLeft size={14} />
        </button>
      </div>

      {!isMac && (
        <div className="win-controls">
          <button
            className="win-btn"
            title="Minimize"
            onClick={() => win.minimize()}
          >
            <Minus size={14} />
          </button>
          <button
            className="win-btn"
            title={maximized ? "Restore" : "Maximize"}
            onClick={() => win.toggleMaximize()}
          >
            <Square size={12} />
          </button>
          <button
            className="win-btn close"
            title="Close"
            onClick={() => win.close()}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </header>
  );
}
