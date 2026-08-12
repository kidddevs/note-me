import { create } from "zustand";
import type { Tab } from "../lib/types";
import { uid } from "../lib/format";

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  openNote: (noteId: number, title?: string, pinned?: boolean) => string;
  openNoteNewTab: (noteId: number, title?: string, pinned?: boolean) => string;
  openView: (view: NonNullable<Tab["view"]>, title: string) => string;
  openHome: () => string;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  activate: (id: string) => void;
  activateRelative: (dir: 1 | -1) => void;
  moveTab: (from: number, to: number) => void;
  renameTab: (id: string, title: string, pinned?: boolean) => void;
}

function pickActive(tabs: Tab[], closedIndex: number, previousActive: string | null): string | null {
  if (tabs.length === 0) return null;
  const idx = Math.min(closedIndex, tabs.length - 1);
  return tabs[idx]?.id ?? previousActive;
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,

  openNote: (noteId, title = "Untitled", pinned = false) => {
    const existing = get().tabs.find((t) => t.kind === "note" && t.noteId === noteId);
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    return get().openNoteNewTab(noteId, title, pinned);
  },

  openNoteNewTab: (noteId, title = "Untitled", pinned = false) => {
    const id = uid();
    const tab: Tab = { id, kind: "note", noteId, title, pinned };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: id }));
    return id;
  },

  openView: (view, title) => {
    const key = `${view.kind}:${view.id ?? ""}:${view.query ?? ""}`;
    const existing = get().tabs.find(
      (t) => t.kind === "view" && `${t.view?.kind}:${t.view?.id ?? ""}:${t.view?.query ?? ""}` === key
    );
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    const id = uid();
    const tab: Tab = { id, kind: "view", view, title };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: id }));
    return id;
  },

  openHome: () => {
    const existing = get().tabs.find((t) => t.kind === "view" && t.view?.kind === "all");
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    return get().openView({ kind: "all" }, "All Notes");
  },

  closeTab: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeId = s.activeId;
      if (s.activeId === id) {
        activeId = pickActive(tabs, idx, null);
      }
      return { tabs, activeId };
    });
  },

  closeOtherTabs: (id) => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab) return s;
      return { tabs: [tab], activeId: tab.id };
    });
  },

  closeAllTabs: () => set({ tabs: [], activeId: null }),

  activate: (id) => set({ activeId: id }),

  activateRelative: (dir) => {
    const { tabs, activeId, activate } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeId);
    const next = (idx + dir + tabs.length) % tabs.length;
    activate(tabs[next].id);
  },

  moveTab: (from, to) => {
    set((s) => {
      const tabs = [...s.tabs];
      const [tab] = tabs.splice(from, 1);
      tabs.splice(to, 0, tab);
      return { tabs };
    });
  },

  renameTab: (id, title, pinned) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, title, pinned } : t)),
    }));
  },
}));
