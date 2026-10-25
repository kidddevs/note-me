import { create } from "zustand";
import { uid } from "../lib/format";

export type BookTabScreen = "library" | "manuscript" | "outline" | "settings" | "export";

export interface BookTab {
  id: string;
  kind: "library" | "book";
  bookId?: number;
  title: string;
  screen: BookTabScreen;
}

interface BookTabsState {
  tabs: BookTab[];
  activeId: string | null;
  openLibrary: () => BookTab;
  openBook: (bookId: number, title?: string) => BookTab;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  closeBookTabs: (bookId: number) => void;
  activate: (id: string) => void;
  activateRelative: (dir: 1 | -1) => void;
  moveTab: (from: number, to: number) => void;
  renameBook: (bookId: number, title: string) => void;
  setScreen: (id: string, screen: BookTabScreen) => void;
}

function pickActive(tabs: BookTab[], closedIndex: number): string | null {
  if (tabs.length === 0) return null;
  return tabs[Math.min(closedIndex, tabs.length - 1)]?.id ?? null;
}

export const useBookTabs = create<BookTabsState>((set, get) => ({
  tabs: [],
  activeId: null,

  openLibrary: () => {
    const existing = get().tabs.find((tab) => tab.kind === "library");
    if (existing) {
      set({ activeId: existing.id });
      return existing;
    }
    const tab: BookTab = { id: uid(), kind: "library", title: "Library", screen: "library" };
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    return tab;
  },

  openBook: (bookId, title = "Untitled manuscript") => {
    const existing = get().tabs.find((tab) => tab.kind === "book" && tab.bookId === bookId);
    if (existing) {
      set({ activeId: existing.id });
      return existing;
    }
    const tab: BookTab = { id: uid(), kind: "book", bookId, title, screen: "manuscript" };
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    return tab;
  },

  closeTab: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      return {
        tabs,
        activeId: state.activeId === id ? pickActive(tabs, index) : state.activeId,
      };
    });
  },

  closeOtherTabs: (id) => {
    set((state) => {
      const tab = state.tabs.find((item) => item.id === id);
      if (!tab) return state;
      return { tabs: [tab], activeId: tab.id };
    });
  },

  closeAllTabs: () => set({ tabs: [], activeId: null }),

  closeBookTabs: (bookId) => {
    set((state) => {
      const tabs = state.tabs.filter((tab) => !(tab.kind === "book" && tab.bookId === bookId));
      if (tabs.length === state.tabs.length) return state;
      const activeExists = tabs.some((tab) => tab.id === state.activeId);
      const activeId = activeExists
        ? state.activeId
        : tabs.find((tab) => tab.kind === "library")?.id ?? tabs[0]?.id ?? null;
      return { tabs, activeId };
    });
  },

  activate: (id) => set({ activeId: id }),

  activateRelative: (dir) => {
    const { tabs, activeId, activate } = get();
    if (tabs.length === 0) return;
    const index = tabs.findIndex((tab) => tab.id === activeId);
    activate(tabs[(index + dir + tabs.length) % tabs.length].id);
  },

  moveTab: (from, to) => {
    set((state) => {
      const tabs = [...state.tabs];
      const [tab] = tabs.splice(from, 1);
      tabs.splice(to, 0, tab);
      return { tabs };
    });
  },

  renameBook: (bookId, title) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.kind === "book" && tab.bookId === bookId ? { ...tab, title } : tab
      ),
    }));
  },

  setScreen: (id, screen) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id && tab.kind === "book" ? { ...tab, screen } : tab
      ),
    }));
  },
}));
