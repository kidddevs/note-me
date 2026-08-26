export interface Tag {
  id: number;
  name: string;
  color: string;
  note_count: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  trashed: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  snippet: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  note_count: number;
}

export interface ClipboardItem {
  id: number;
  kind: string;
  content: string;
  created_at: string;
}

export interface AppStats {
  total_notes: number;
  favorites: number;
  trashed: number;
}

export type Theme = "system" | "light" | "dark";
export type EditorMode = "edit" | "split" | "preview";

export type SidebarSelection =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "tasks" }
  | { kind: "archived" }
  | { kind: "trash" }
  | { kind: "category"; id: number }
  | { kind: "tag"; id: number };

export type ViewKind = "all" | "favorites" | "tasks" | "archived" | "trash" | "category" | "tag" | "search";

export interface TaskItem {
  note_id: number;
  note_title: string;
  line_index: number;
  text: string;
  done: boolean;
}

export interface Tab {
  id: string;
  kind: "note" | "view";
  noteId?: number;
  view?: { kind: ViewKind; id?: number; query?: string };
  title: string;
  pinned?: boolean;
}
