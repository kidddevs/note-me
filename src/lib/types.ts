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

export interface Book {
  id: number;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  genre: string;
  status: string;
  trim_size: string;
  font_family: string;
  font_size: number;
  line_height: number;
  paragraph_spacing: number;
  margin: number;
  word_goal: number;
  cover_color: string;
  dedication: string;
  epigraph: string;
  copyright_text: string;
  acknowledgements: string;
  toc_enabled: boolean;
  toc_title: string;
  toc_depth: number;
  toc_include_front_matter: boolean;
  toc_include_back_matter: boolean;
  layout_json: string;
  created_at: string;
  updated_at: string;
}

export interface BookInput {
  title: string;
  subtitle: string;
  author: string;
  description: string;
  genre: string;
  status: string;
  trimSize: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  margin: number;
  wordGoal?: number;
  coverColor?: string;
  dedication?: string;
  epigraph?: string;
  copyrightText?: string;
  acknowledgements?: string;
  tocEnabled?: boolean;
  tocTitle?: string;
  tocDepth?: number;
  tocIncludeFrontMatter?: boolean;
  tocIncludeBackMatter?: boolean;
  layoutJson?: string;
}

export type ChapterKind =
  | "title_page"
  | "dedication"
  | "epigraph"
  | "copyright"
  | "prologue"
  | "chapter"
  | "interlude"
  | "appendix"
  | "acknowledgements"
  | "about_author";

export interface Chapter {
  id: number;
  book_id: number;
  chapter_kind: ChapterKind;
  title: string;
  content: string;
  position: number;
  toc_include: boolean;
  toc_heading_exclusions: string[];
  created_at: string;
  updated_at: string;
}

export interface ChapterInput {
  title: string;
  content: string;
  chapterKind?: ChapterKind;
  position?: number;
  tocInclude?: boolean;
  tocHeadingExclusions?: string[];
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
