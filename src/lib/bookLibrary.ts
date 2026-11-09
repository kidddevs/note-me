import type { Book } from "./types";
import { STATUS_OPTIONS } from "./bookPublishing";

export type LibrarySort = "recent" | "title" | "stage" | "created";
export type LibraryStatusFilter = "all" | "draft" | "revising" | "ready" | "published";

export interface LibraryFilterOptions {
  query?: string;
  status?: LibraryStatusFilter;
  sort?: LibrarySort;
}

export const LIBRARY_SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: "recent", label: "Recently edited" },
  { value: "stage", label: "Furthest along" },
  { value: "title", label: "Title A–Z" },
  { value: "created", label: "Newest first" },
];

const STAGE_RANK: Record<string, number> = { published: 0, ready: 1, revising: 2, draft: 3 };

function timestamp(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function libraryStatusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status.replace(/[_-]/g, " ");
}

/** The searchable surface of a shelf card: metadata only, never manuscript text. */
export function libraryBookSearchText(book: Book) {
  return [book.title, book.subtitle, book.author, book.genre, book.description, libraryStatusLabel(book.status), book.trim_size]
    .join(" ")
    .toLocaleLowerCase();
}

export function filterLibraryBooks(books: Book[], options: LibraryFilterOptions = {}) {
  const terms = (options.query ?? "").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const status = options.status ?? "all";
  const sort = options.sort ?? "recent";
  return books
    .filter((book) => (status === "all" || book.status === status) && terms.every((term) => libraryBookSearchText(book).includes(term)))
    .sort((a, b) => {
      if (sort === "title") return (a.title || "Untitled manuscript").localeCompare(b.title || "Untitled manuscript") || a.id - b.id;
      if (sort === "created") return timestamp(b.created_at) - timestamp(a.created_at) || b.id - a.id;
      if (sort === "stage") return (STAGE_RANK[a.status] ?? 9) - (STAGE_RANK[b.status] ?? 9) || timestamp(b.updated_at) - timestamp(a.updated_at) || b.id - a.id;
      return timestamp(b.updated_at) - timestamp(a.updated_at) || b.id - a.id;
    });
}

/** Counts include every saved stage so the toolbar can explain the whole shelf. */
export function libraryStatusCounts(books: Book[]) {
  const counts: Record<LibraryStatusFilter, number> = { all: books.length, draft: 0, revising: 0, ready: 0, published: 0 };
  for (const book of books) {
    if (book.status !== "all" && Object.prototype.hasOwnProperty.call(counts, book.status)) {
      counts[book.status as Exclude<LibraryStatusFilter, "all">] += 1;
    }
  }
  return counts;
}
