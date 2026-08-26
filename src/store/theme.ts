import { create } from "zustand";
import type { EditorMode, Theme } from "../lib/types";
import { api } from "../lib/api";
import { setSoundEnabled } from "../lib/sounds";

export type FontSize = "sm" | "md" | "lg";

interface ThemeState {
  theme: Theme;
  editorMode: EditorMode;
  sidebarCollapsed: boolean;
  fontSize: FontSize;
  spellcheck: boolean;
  soundEffects: boolean;
  ready: boolean;
  init: () => Promise<void>;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
  setEditorMode: (m: EditorMode) => void;
  toggleSidebar: () => void;
  setFontSize: (f: FontSize) => void;
  setSpellcheck: (v: boolean) => void;
  setSoundEffects: (v: boolean) => void;
}

const THEME_KEY = "ui.theme";
const EDITOR_KEY = "ui.editorMode";
const SIDEBAR_KEY = "ui.sidebarCollapsed";
const FONT_KEY = "ui.fontSize";
const SPELL_KEY = "ui.spellcheck";
const SOUND_KEY = "ui.soundEffects";

const FONT_PX: Record<FontSize, string> = { sm: "13px", md: "14px", lg: "16px" };

function applyFontSize(f: FontSize) {
  document.documentElement.style.setProperty("--editor-font-size", FONT_PX[f]);
}

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
  fontSize: "md",
  spellcheck: false,
  soundEffects: true,
  ready: false,
  init: async () => {
    const [t, m, sc, fs, sp, snd] = await Promise.all([
      api.getSetting(THEME_KEY),
      api.getSetting(EDITOR_KEY),
      api.getSetting(SIDEBAR_KEY),
      api.getSetting(FONT_KEY),
      api.getSetting(SPELL_KEY),
      api.getSetting(SOUND_KEY),
    ]);
    const theme = (t as Theme) ?? "system";
    const mode = (m as EditorMode) ?? "split";
    const font = (fs as FontSize) ?? "md";
    const sound = snd === null ? true : snd === "1";
    applyTheme(theme);
    applyFontSize(font);
    setSoundEnabled(sound);
    set({
      theme,
      editorMode: mode,
      sidebarCollapsed: sc === "1",
      fontSize: font,
      spellcheck: sp === "1",
      soundEffects: sound,
      ready: true,
    });
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
  setFontSize: (f) => {
    applyFontSize(f);
    api.setSetting(FONT_KEY, f).catch(() => {});
    set({ fontSize: f });
  },
  setSpellcheck: (v) => {
    api.setSetting(SPELL_KEY, v ? "1" : "0").catch(() => {});
    set({ spellcheck: v });
  },
  setSoundEffects: (v) => {
    setSoundEnabled(v);
    api.setSetting(SOUND_KEY, v ? "1" : "0").catch(() => {});
    set({ soundEffects: v });
  },
}));

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  const s = useTheme.getState();
  if (s.theme === "system") {
    document.documentElement.dataset.theme = e.matches ? "dark" : "light";
  }
});
