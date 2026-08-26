import { invoke } from "@tauri-apps/api/core";
import type { AppStats, Category, ClipboardItem, Note, Tag, TaskItem } from "./types";

export const api = {
  listNotes: () => invoke<Note[]>("list_notes"),
  listArchived: () => invoke<Note[]>("list_archived"),
  listTrashed: () => invoke<Note[]>("list_trashed"),
  listFavorites: () => invoke<Note[]>("list_favorites"),
  listTasks: () => invoke<TaskItem[]>("list_tasks"),
  notesByCategory: (id: number) => invoke<Note[]>("notes_by_category", { categoryId: id }),
  notesByTag: (id: number) => invoke<Note[]>("notes_by_tag", { tagId: id }),
  search: (q: string) => invoke<Note[]>("search_notes", { query: q }),
  getNote: (id: number) => invoke<Note | null>("get_note", { id }),
  createNote: (title: string, content: string, categoryId?: number | null) =>
    invoke<Note>("create_note", { title, content, categoryId }),
  updateNote: (id: number, title: string, content: string, categoryId?: number | null) =>
    invoke<void>("update_note", { id, title, content, categoryId }),
  setNoteCategory: (id: number, categoryId: number | null) =>
    invoke<void>("set_note_category", { id, categoryId }),
  togglePin: (id: number) => invoke<void>("toggle_pin", { id }),
  toggleFavorite: (id: number) => invoke<void>("toggle_favorite", { id }),
  toggleArchive: (id: number) => invoke<void>("toggle_archive", { id }),
  trashNote: (id: number) => invoke<void>("trash_note", { id }),
  restoreNote: (id: number) => invoke<void>("restore_note", { id }),
  deleteForever: (id: number) => invoke<void>("delete_note_forever", { id }),
  emptyTrash: () => invoke<void>("empty_trash"),

  listCategories: () => invoke<Category[]>("list_categories"),
  createCategory: (name: string, color: string, icon: string) =>
    invoke<number>("create_category", { name, color, icon }),
  updateCategory: (id: number, name: string, color: string, icon: string) =>
    invoke<void>("update_category", { id, name, color, icon }),
  deleteCategory: (id: number) => invoke<void>("delete_category", { id }),

  listTags: () => invoke<Tag[]>("list_tags"),
  createTag: (name: string, color: string) => invoke<number>("create_tag", { name, color }),
  deleteTag: (id: number) => invoke<void>("delete_tag", { id }),
  setNoteTags: (noteId: number, tagIds: number[]) =>
    invoke<void>("set_note_tags", { noteId, tagIds }),

  listClipboard: (limit = 100) => invoke<ClipboardItem[]>("list_clipboard_items", { limit }),
  saveClipboard: (content: string) => invoke<number>("save_clipboard_item", { content }),
  deleteClipboardItem: (id: number) => invoke<void>("delete_clipboard_item", { id }),
  clearClipboard: () => invoke<void>("clear_clipboard_history"),

  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  stats: () => invoke<AppStats>("app_stats"),
  saveAttachment: (data: number[], ext: string) =>
    invoke<string>("save_attachment", { data, ext }),
};
