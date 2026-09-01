import { create } from "zustand";
import { api } from "../lib/api";

export type WorkspaceMode = "notes" | "books";

interface WorkspaceState {
  mode: WorkspaceMode;
  ready: boolean;
  booksSidebarCollapsed: boolean;
  init: () => Promise<void>;
  setMode: (mode: WorkspaceMode) => void;
  toggle: () => void;
  toggleBooksSidebar: () => void;
}

const WORKSPACE_KEY = "ui.workspace";
const BOOKS_SIDEBAR_KEY = "ui.booksSidebarCollapsed";

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  mode: "notes",
  ready: false,
  booksSidebarCollapsed: false,
  init: async () => {
    const [savedWorkspace, savedBooksSidebar] = await Promise.all([
      api.getSetting(WORKSPACE_KEY).catch(() => null),
      api.getSetting(BOOKS_SIDEBAR_KEY).catch(() => null),
    ]);
    const mode: WorkspaceMode = savedWorkspace === "books" ? "books" : "notes";
    set({ mode, booksSidebarCollapsed: savedBooksSidebar === "1", ready: true });
  },
  setMode: (mode) => {
    if (mode === get().mode) return;
    set({ mode });
    api.setSetting(WORKSPACE_KEY, mode).catch(() => {});
  },
  toggle: () => {
    get().setMode(get().mode === "notes" ? "books" : "notes");
  },
  toggleBooksSidebar: () => set((state) => {
    const booksSidebarCollapsed = !state.booksSidebarCollapsed;
    api.setSetting(BOOKS_SIDEBAR_KEY, booksSidebarCollapsed ? "1" : "0").catch(() => {});
    return { booksSidebarCollapsed };
  }),
}));
