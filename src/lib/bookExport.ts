import { backMatterSections, buildBookToc, frontMatterSections } from "./bookToc";
import { layoutForBook, serializeBookLayout } from "./bookLayout";
import { downloadBlob, hasCoverDocument } from "./bookCoverDoc";
import { bookExportPayload, EXPORT_OPTIONS, filenameFor, hasManuscriptContent, isDocxImageSource, parseImageLine, wordCount, type BookExportFormat } from "./bookPublishing";
import { parseChapterWorkflow } from "./bookWorkflow";
import type { Book, Chapter } from "./types";

export type BookExportCheckSeverity = "error" | "warning" | "info";
export type BookExportCheckTarget = "settings" | "outline" | "manuscript";

export type BookOutputFormat = BookExportFormat | "print";

interface BookOutputOption extends Omit<(typeof EXPORT_OPTIONS)[number], "value"> {
  value: BookOutputFormat;
  coverPanel: "front" | "wrap" | null;
}

export const BOOK_OUTPUT_OPTIONS: BookOutputOption[] = [
  ...EXPORT_OPTIONS.map((option): BookOutputOption => ({
    ...option,
    coverPanel: option.value === "epub" || option.value === "html" ? "front" : null,
  })),
  { value: "print", label: "Print / PDF", description: "Paginated proof with an optional cover", extension: ".pdf", mime: "application/pdf", coverPanel: "wrap", note: "Choose Save as PDF in the print dialog. On macOS, the selected paper size sets the dimensions of every page." },
];

export interface BookExportChoices {
  includeCover?: boolean;
  includeContents?: boolean;
}

/** Resolve one edition without writing the manuscript's publication settings. */
export function bookForExport(book: Book, format: BookOutputFormat, choices: BookExportChoices = {}): Book {
  const layout = layoutForBook(book);
  const supportsCover = Boolean(BOOK_OUTPUT_OPTIONS.find((option) => option.value === format)?.coverPanel);
  const coverAvailable = layout.cover.enabled || hasCoverDocument(layout.cover);
  const coverEnabled = supportsCover && coverAvailable && (choices.includeCover ?? layout.cover.enabled);
  const tocEnabled = choices.includeContents ?? book.toc_enabled;
  if (coverEnabled === layout.cover.enabled && tocEnabled === book.toc_enabled) return book;
  return {
    ...book,
    toc_enabled: tocEnabled,
    layout_json: coverEnabled === layout.cover.enabled ? book.layout_json : serializeBookLayout({ ...layout, cover: { ...layout.cover, enabled: coverEnabled } }),
  };
}

export interface BookExportCheck {
  id: string;
  label: string;
  detail: string;
  severity: BookExportCheckSeverity;
  target: BookExportCheckTarget;
  chapterId?: number;
}

const STORY_KINDS = new Set(["editorial", "prologue", "chapter", "feature", "department", "column", "profile", "interview", "review", "photo_essay", "recipe", "listing", "interlude"]);

export function bookExportChecks(book: Book, chapters: Chapter[]): BookExportCheck[] {
  const checks: BookExportCheck[] = [];
  const title = book.title.trim();

  if (!title || title.toLocaleLowerCase() === "untitled manuscript") {
    checks.push({ id: "title", label: "Name the manuscript", detail: "Replace the working title before sharing a reader copy.", severity: "warning", target: "settings" });
  }
  if (!book.author.trim()) {
    checks.push({ id: "author", label: "Add the author name", detail: "Set the author credited on the reader copy.", severity: "warning", target: "settings" });
  }
  if (!book.description.trim()) {
    checks.push({ id: "description", label: "Add a book description", detail: "A short description improves ebook metadata and the exported cover page.", severity: "info", target: "settings" });
  }
  if (chapters.length === 0) {
    checks.push({ id: "sections", label: "Add a manuscript section", detail: "There is no writing to include in an exported file yet.", severity: "error", target: "manuscript" });
    return checks;
  }

  const emptyStorySections = chapters.filter((chapter) => STORY_KINDS.has(chapter.chapter_kind) && !hasManuscriptContent(chapter.content));
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

  if (!chapters.some((chapter) => chapter.chapter_kind === "title_page" || chapter.chapter_kind === "cover")) {
    checks.push({ id: "title-page", label: "Consider a title page", detail: "A dedicated title page gives print and editable exports a finished opening.", severity: "info", target: "outline" });
  }

  return checks;
}

export type BookPackageCover = "layered" | "template" | "off";

export interface BookPackageSummary {
  sections: number;
  words: number;
  readingMinutes: number;
  readySections: number;
  cover: BookPackageCover;
  contentsEntries: number;
  images: number;
  imageReferences: number;
  imageDescriptions: number;
  imageCredits: boolean;
}

/** Describe the selected edition using the same artwork rules as its builder. */
export function bookPackageSummary(book: Book, chapters: Chapter[], format: BookOutputFormat = "html"): BookPackageSummary {
  const layout = layoutForBook(book);
  const words = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  const sections = [...chapters, ...frontMatterSections(book, chapters), ...backMatterSections(book, chapters)];
  const artwork = sections.flatMap((section) => section.content.split(/\r?\n/).map(parseImageLine).filter((image) => image !== null));
  const placedArtwork = format === "docx" ? artwork.filter((image) => isDocxImageSource(image.source))
    : format === "txt" || format === "markdown" ? [] : artwork;
  const supportsCover = Boolean(BOOK_OUTPUT_OPTIONS.find((option) => option.value === format)?.coverPanel);
  return {
    sections: chapters.length,
    words,
    readingMinutes: words > 0 ? Math.max(1, Math.round(words / 250)) : 0,
    readySections: chapters.filter((chapter) => parseChapterWorkflow(chapter.workflow_json).status === "ready").length,
    cover: !supportsCover || !layout.cover.enabled ? "off" : hasCoverDocument(layout.cover) ? "layered" : "template",
    contentsEntries: buildBookToc(book, chapters).length,
    images: placedArtwork.length,
    imageReferences: format === "markdown" ? artwork.length : 0,
    imageDescriptions: format === "txt" || format === "docx" ? artwork.length - placedArtwork.length : 0,
    imageCredits: (format === "txt" ? [] : artwork).some((image) => Boolean(image.presentation.credit)),
  };
}

export interface BookExportCheckGroups {
  attention: BookExportCheck[];
  suggestions: BookExportCheck[];
}

/** Errors and warnings stay together above the optional finishing suggestions. */
export function groupBookExportChecks(checks: BookExportCheck[]): BookExportCheckGroups {
  return {
    attention: checks.filter((check) => check.severity !== "info"),
    suggestions: checks.filter((check) => check.severity === "info"),
  };
}

export interface BookExportReceipt {
  filename: string;
  path: string | null;
  bytes: number;
}

/** Save the resolved edition using the system dialog or the browser downloader. */
export async function saveBookExport(book: Book, chapters: Chapter[], format: BookExportFormat): Promise<BookExportReceipt | null> {
  const option = EXPORT_OPTIONS.find((item) => item.value === format);
  if (!option) throw new Error(`Unsupported book export format: ${format}`);
  const filename = filenameFor(book, option.extension);
  if (!("__TAURI_INTERNALS__" in window)) {
    const payload = await bookExportPayload(book, chapters, format);
    const blob = new Blob([typeof payload === "string" ? payload : new Uint8Array(payload)], { type: option.mime });
    downloadBlob(blob, filename);
    return { filename, path: null, bytes: blob.size };
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: filename, filters: [{ name: option.label, extensions: [option.extension.slice(1)] }] });
  if (!path) return null;
  const payload = await bookExportPayload(book, chapters, format);
  const { writeFile, writeTextFile } = await import("@tauri-apps/plugin-fs");
  if (typeof payload === "string") await writeTextFile(path, payload);
  else await writeFile(path, payload);
  return {
    filename: path.split(/[\\/]/).pop() || filename,
    path,
    bytes: typeof payload === "string" ? new TextEncoder().encode(payload).length : payload.byteLength,
  };
}
