import { create } from "zustand";
import type { EditorMode, Theme } from "../lib/types";
import { api } from "../lib/api";

interface ThemeState {
  theme: Theme;
  editorMode: EditorMode;
  sidebarCollapsed: boolean;
  ready: boolean;
  init: () => Promise<void>;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
  setEditorMode: (m: EditorMode) => void;
  toggleSidebar: () => void;
}

const THEME_KEY = "ui.theme";
const EDITOR_KEY = "ui.editorMode";
const SIDEBAR_KEY = "ui.sidebarCollapsed";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "dark" : "light";
  } else {
    root.dataset.theme = t;
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "system",
  editorMode: "split",
  sidebarCollapsed: false,
  ready: false,
  init: async () => {
    const [t, m, sc] = await Promise.all([
      api.getSetting(THEME_KEY),
      api.getSetting(EDITOR_KEY),
      api.getSetting(SIDEBAR_KEY),
    ]);
    const theme = (t as Theme) ?? "system";
    const mode = (m as EditorMode) ?? "split";
    applyTheme(theme);
    set({ theme, editorMode: mode, sidebarCollapsed: sc === "1", ready: true });
  },
  setTheme: (t) => {
    applyTheme(t);
    api.setSetting(THEME_KEY, t).catch(() => {});
    set({ theme: t });
  },
  cycleTheme: () => {
    const order: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
    get().setTheme(order[get().theme]);
  },
  setEditorMode: (m) => {
    api.setSetting(EDITOR_KEY, m).catch(() => {});
    set({ editorMode: m });
  },
  toggleSidebar: () => {
    set((s) => {
      const next = !s.sidebarCollapsed;
      api.setSetting(SIDEBAR_KEY, next ? "1" : "0").catch(() => {});
      return { sidebarCollapsed: next };
    });
  },
}));

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  const s = useTheme.getState();
  if (s.theme === "system") {
    document.documentElement.dataset.theme = e.matches ? "dark" : "light";
  }
});
