import { create } from "zustand";
import {
  Check,
  Clipboard,
  FilePlus2,
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
import { useTheme } from "../store/theme";
import { useNotes } from "../store/notes";
import { notify } from "../store/toast";
import type { Tab } from "../lib/types";
import { useEffect, useRef, useState } from "react";

export const isMac =
  navigator.userAgent.includes("Macintosh") ||
  navigator.platform?.toLowerCase().includes("mac");

interface MenuState {
  x: number;
  y: number;
  tabId: string;
}

interface TabMenuState {
  menu: MenuState | null;
  drag: { id: string } | null;
  setMenu: (m: MenuState | null) => void;
  setDrag: (d: { id: string } | null) => void;
  dropOn: (targetId: string) => void;
}

const useTabMenu = create<TabMenuState>((set) => ({
  menu: null,
  drag: null,
  setMenu: (menu) => set({ menu }),
  setDrag: (drag) => set({ drag }),
  dropOn: (targetId) => {
    const { drag } = useTabMenu.getState();
    const s = useTabs.getState();
    const from = s.tabs.findIndex((t) => t.id === drag?.id);
    const to = s.tabs.findIndex((t) => t.id === targetId);
    if (from !== -1 && to !== -1 && from !== to) {
      s.moveTab(from, to);
      if (drag?.id) s.activate(drag.id);
    }
    set({ drag: null });
  },
}));

function TabComponent({ tab }: { tab: Tab }) {
  const activate = useTabs((s) => s.activate);
  const closeTab = useTabs((s) => s.closeTab);
  const activeId = useTabs((s) => s.activeId);
  const setMenu = useTabMenu((s) => s.setMenu);
  const drag = useTabMenu((s) => s.drag);

  return (
    <div
      className={`tab ${tab.id === activeId ? "active" : ""} ${drag?.id === tab.id ? "tab-drag" : ""}`}
      onClick={() => activate(tab.id)}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          closeTab(tab.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
      }}
      draggable
      onDragStart={(e) => {
        useTabMenu.getState().setDrag({ id: tab.id });
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => useTabMenu.getState().setDrag(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        useTabMenu.getState().dropOn(tab.id);
      }}
      title={tab.title}
    >
      {tab.kind === "note" ? (
        tab.pinned ? (
          <Pin size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
        ) : (
          <StickyNote size={12} style={{ flexShrink: 0, opacity: 0.75 }} />
        )
      ) : (
        <Search size={12} style={{ flexShrink: 0, opacity: 0.75 }} />
      )}
      <span className="tab-title">{tab.title}</span>
      <button
        className="tab-close"
        title="Close tab (⌘W)"
        onClick={(e) => {
          e.stopPropagation();
          closeTab(tab.id);
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function TabContextMenu() {
  const menu = useTabMenu((s) => s.menu);
  const setMenu = useTabMenu((s) => s.setMenu);
  const closeTab = useTabs((s) => s.closeTab);
  const closeOtherTabs = useTabs((s) => s.closeOtherTabs);
  const closeAllTabs = useTabs((s) => s.closeAllTabs);
  if (!menu) return null;
  return (
    <div
      className="menu-wrap"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="menu-item"
        onClick={() => {
          closeTab(menu.tabId);
          setMenu(null);
        }}
      >
        <X size={13} /> Close Tab
      </button>
      <button
        className="menu-item"
        onClick={() => {
          closeOtherTabs(menu.tabId);
          setMenu(null);
        }}
      >
        <Check size={13} /> Close Other Tabs
      </button>
      <div className="menu-sep" />
      <button
        className="menu-item danger"
        onClick={() => {
          closeAllTabs();
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
  const theme = useTheme((s) => s.theme);
  const cycleTheme = useTheme((s) => s.cycleTheme);
  const toggleSidebar = useTheme((s) => s.toggleSidebar);
  const toggleClipboardPanel = useNotes((s) => s.toggleClipboardPanel);
  const createNote = useNotes((s) => s.createNote);
  const notes = useNotes((s) => s.notes);
  const [maximized, setMaximized] = useState(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "t") {
        e.preventDefault();
        openHome();
      } else if (k === "n") {
        e.preventDefault();
        newNote();
      } else if (k === "w" && tabs.length > 0) {
        e.preventDefault();
        useTabs.getState().closeTab(useTabs.getState().activeId ?? "");
      } else if (k === "tab") {
        e.preventDefault();
        useTabs.getState().activateRelative(e.shiftKey ? -1 : 1);
      } else if (e.key === "]" && e.shiftKey) {
        e.preventDefault();
        useTabs.getState().activateRelative(1);
      } else if (e.key === "[" && e.shiftKey) {
        e.preventDefault();
        useTabs.getState().activateRelative(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs.length]);

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
          className="icon-btn"
          title="Toggle Sidebar (⌘⌃S)"
          onClick={toggleSidebar}
        >
          <PanelLeft size={15} />
        </button>
        <button
          className="icon-btn"
          title="New Note (⌘N)"
          onClick={newNote}
        >
          <FilePlus2 size={15} />
        </button>
        <button
          className="icon-btn"
          title="Clipboard History (⌘⇧V)"
          onClick={() => toggleClipboardPanel()}
        >
          <Clipboard size={15} />
        </button>
      </div>

      <div
        className="tab-strip"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 1 && e.target === e.currentTarget) {
            e.preventDefault();
            openHome();
          }
        }}
      >
        {tabs.map((t) => (
          <TabComponent key={t.id} tab={t} />
        ))}
        <button
          className="tab-new"
          title="New Tab (⌘T)"
          onClick={openHome}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="win-controls" data-tauri-drag-region>
        <button
          className="icon-btn"
          title={`Appearance: ${theme} (⌘⇧T)`}
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
          title="Command Palette (⌘K)"
          onClick={() => window.dispatchEvent(new CustomEvent("open-palette"))}
        >
          <Search size={14} />
        </button>
        <button
          className="icon-btn"
          title="Preferences (⌘,)"
          onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
        >
          <Settings size={14} />
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
