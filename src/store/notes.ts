import { create } from "zustand";
import type { AppStats, Category, ClipboardItem, Note, SidebarSelection, Tag, TaskItem } from "../lib/types";
import { api } from "../lib/api";
import { notify } from "./toast";
import { useTabs } from "./tabs";

interface NotesState {
  notes: Note[];
  archived: Note[];
  trashed: Note[];
  categories: Category[];
  tags: Tag[];
  clipboard: ClipboardItem[];
  tasks: TaskItem[];
  stats: AppStats;
  selection: SidebarSelection;
  searchQuery: string;
  loading: boolean;
  clipboardOpen: boolean;
  loaded: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setSelection: (sel: SidebarSelection) => void;
  setSearchQuery: (q: string) => void;
  toggleClipboardPanel: (open?: boolean) => void;

  createNote: (title?: string, content?: string, categoryId?: number | null) => Promise<Note | null>;
  deleteNote: (id: number) => Promise<void>;
  restoreNote: (id: number) => Promise<void>;
  deleteForever: (id: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  togglePin: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  toggleArchive: (id: number) => Promise<void>;
  setCategory: (id: number, categoryId: number | null) => Promise<void>;

  addCategory: (name: string, color: string, icon: string) => Promise<void>;
  updateCategory: (id: number, name: string, color: string, icon: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;
  addTag: (name: string, color: string) => Promise<void>;
  removeTag: (id: number) => Promise<void>;

  toggleTask: (noteId: number, lineIndex: number) => Promise<void>;
  captureClipboard: () => Promise<void>;
  clearClipboardHistory: () => Promise<void>;
  removeClipboardItem: (id: number) => Promise<void>;
}

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],
  archived: [],
  trashed: [],
  categories: [],
  tags: [],
  clipboard: [],
  tasks: [],
  stats: { total_notes: 0, favorites: 0, trashed: 0 },
  selection: { kind: "all" },
  searchQuery: "",
  loading: false,
  clipboardOpen: false,
  loaded: false,

  init: async () => {
    await get().refresh();
    set({ loaded: true });
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const [notes, archived, trashed, categories, tags, clipboard, tasks, stats] = await Promise.all([
        api.listNotes(),
        api.listArchived(),
        api.listTrashed(),
        api.listCategories(),
        api.listTags(),
        api.listClipboard(),
        api.listTasks(),
        api.stats(),
      ]);
      set({ notes, archived, trashed, categories, tags, clipboard, tasks, stats, loading: false });
    } catch (e) {
      set({ loading: false });
      notify("error", "Failed to load notes", String(e));
    }
  },

  setSelection: (sel) => set({ selection: sel, searchQuery: "" }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleClipboardPanel: (open) =>
    set((s) => ({ clipboardOpen: open ?? !s.clipboardOpen })),

  createNote: async (title = "", content = "", categoryId = null) => {
    try {
      const note = await api.createNote(title, content, categoryId);
      await get().refresh();
      notify("success", "Note created");
      return note;
    } catch (e) {
      notify("error", "Could not create note", String(e));
      return null;
    }
  },

  deleteNote: async (id) => {
    await api.trashNote(id);
    await get().refresh();
    notify("info", "Moved to trash", "You can restore it from Trash");
  },

  restoreNote: async (id) => {
    await api.restoreNote(id);
    await get().refresh();
    notify("success", "Note restored");
  },

  deleteForever: async (id) => {
    await api.deleteForever(id);
    await get().refresh();
    notify("info", "Note deleted permanently");
  },

  emptyTrash: async () => {
    await api.emptyTrash();
    await get().refresh();
  },

  togglePin: async (id) => {
    await api.togglePin(id);
    await get().refresh();
  },

  toggleFavorite: async (id) => {
    await api.toggleFavorite(id);
    await get().refresh();
  },

  toggleArchive: async (id) => {
    await api.toggleArchive(id);
    await get().refresh();
  },

  setCategory: async (id, categoryId) => {
    await api.setNoteCategory(id, categoryId);
    await get().refresh();
  },

  addCategory: async (name, color, icon) => {
    await api.createCategory(name, color, icon);
    await get().refresh();
    notify("success", "Category created", name);
  },

  updateCategory: async (id, name, color, icon) => {
    await api.updateCategory(id, name, color, icon);
    await get().refresh();
    notify("success", "Category updated", name);
  },

  removeCategory: async (id) => {
    await api.deleteCategory(id);
    await get().refresh();
    notify("info", "Category deleted");
  },

  addTag: async (name, color) => {
    await api.createTag(name, color);
    await get().refresh();
  },

  removeTag: async (id) => {
    await api.deleteTag(id);
    await get().refresh();
  },

  toggleTask: async (noteId, lineIndex) => {
    const all = [...get().notes, ...get().archived];
    const note = all.find((n) => n.id === noteId);
    if (!note) return;
    const lines = note.content.split("\n");
    const line = lines[lineIndex];
    if (line === undefined) return;
    lines[lineIndex] = /\[ \]/.test(line)
      ? line.replace("[ ]", "[x]")
      : line.replace(/\[[xX]\]/, "[ ]");
    try {
      await api.updateNote(noteId, note.title, lines.join("\n"), note.category_id);
      await get().refresh();
    } catch (e) {
      notify("error", "Could not update task", String(e));
    }
  },

  captureClipboard: async () => {
    try {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      const text = await readText();
      if (text && text.trim()) {
        await api.saveClipboard(text);
        await get().refresh();
      }
    } catch {
      // clipboard read may fail on some platforms; ignore
    }
  },

  clearClipboardHistory: async () => {
    await api.clearClipboard();
    set({ clipboard: [] });
    notify("info", "Clipboard history cleared");
  },

  removeClipboardItem: async (id) => {
    await api.deleteClipboardItem(id);
    set((s) => ({ clipboard: s.clipboard.filter((c) => c.id !== id) }));
  },
}));

export function openNoteInTab(note: Note | null | undefined) {
  if (!note) return;
  useTabs.getState().openNote(note.id, note.title || "Untitled", note.pinned);
}
