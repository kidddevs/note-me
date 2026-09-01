import { buildBookToc } from "./bookToc";
import type { Book, Chapter } from "./types";

export type BookExportCheckSeverity = "error" | "warning" | "info";
export type BookExportCheckTarget = "settings" | "outline" | "manuscript";

export interface BookExportCheck {
  id: string;
  label: string;
  detail: string;
  severity: BookExportCheckSeverity;
  target: BookExportCheckTarget;
  chapterId?: number;
}

const STORY_KINDS = new Set(["prologue", "chapter", "interlude"]);

export function bookExportChecks(book: Book, chapters: Chapter[]): BookExportCheck[] {
  const checks: BookExportCheck[] = [];
  const title = book.title.trim();

  if (!title || title.toLocaleLowerCase() === "untitled manuscript") {
    checks.push({ id: "title", label: "Name the manuscript", detail: "Replace the working title before sharing a reader copy.", severity: "warning", target: "settings" });
  }
  if (!book.author.trim()) {
    checks.push({ id: "author", label: "Add the author name", detail: "EPUB and Word metadata currently use an anonymous fallback.", severity: "warning", target: "settings" });
  }
  if (!book.description.trim()) {
    checks.push({ id: "description", label: "Add a book description", detail: "A short description improves ebook metadata and the exported cover page.", severity: "info", target: "settings" });
  }
  if (chapters.length === 0) {
    checks.push({ id: "sections", label: "Add a manuscript section", detail: "There is no writing to include in an exported file yet.", severity: "error", target: "manuscript" });
    return checks;
  }

  const emptyStorySections = chapters.filter((chapter) => STORY_KINDS.has(chapter.chapter_kind) && !chapter.content.trim());
  if (emptyStorySections.length) {
    checks.push({
      id: "empty-sections",
      label: `${emptyStorySections.length} empty story ${emptyStorySections.length === 1 ? "section" : "sections"}`,
      detail: "Review empty chapters before sending the manuscript to a reader.",
      severity: "warning",
      target: "manuscript",
      chapterId: emptyStorySections[0].id,
    });
  }

  if (book.toc_enabled && buildBookToc(book, chapters).length === 0) {
    checks.push({ id: "contents", label: "Contents has no entries", detail: "Include a section or heading, or turn off the generated contents page.", severity: "warning", target: "outline" });
  }

  const normalizedTitles = chapters.map((chapter) => chapter.title.trim().toLocaleLowerCase()).filter(Boolean);
  const duplicateTitles = new Set(normalizedTitles.filter((titleValue, index) => normalizedTitles.indexOf(titleValue) !== index));
  if (duplicateTitles.size) {
    checks.push({ id: "duplicate-titles", label: "Review repeated section titles", detail: "Repeated titles can make the contents and reader navigation ambiguous.", severity: "info", target: "outline" });
  }

  if (!chapters.some((chapter) => chapter.chapter_kind === "title_page")) {
    checks.push({ id: "title-page", label: "Consider a title page", detail: "A dedicated title page gives print and editable exports a finished opening.", severity: "info", target: "outline" });
  }

  return checks;
}
