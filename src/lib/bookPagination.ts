import { layoutForBook, layoutForChapter, type BookLayout } from "./bookLayout";
import { backMatterSections, buildBookToc, frontMatterSections, orderBookChapters } from "./bookToc";
import { chapterPageBand, wordCount, type PageBand } from "./bookPublishing";
import type { Book, Chapter } from "./types";

export interface BookPaginationSection {
  id: string;
  label: string;
  band: PageBand;
  chapterId?: number;
  words: number;
  estimatedPages: number;
}

export interface BookPaginationEstimate {
  estimatedPages: number;
  textCapacity: number;
  sections: BookPaginationSection[];
}

interface TrimDimensions {
  width: number;
  height: number;
}

function trimDimensions(trimSize: string): TrimDimensions {
  const [width, height] = (trimSize || "6x9").split("x").map((part) => Number.parseFloat(part));
  return {
    width: Number.isFinite(width) && width > 0 ? width : 6,
    height: Number.isFinite(height) && height > 0 ? height : 9,
  };
}

function wordsPerPage(trimSize: string, layout: BookLayout) {
  const trim = trimDimensions(trimSize);
  const margins = layout.pageMargins;
  const widthPoints = Math.max(144, (trim.width - margins.left - margins.right) * 72);
  const heightPoints = Math.max(288, (trim.height - margins.top - margins.bottom) * 72);
  const paragraph = layout.typography.paragraph;
  const fontSize = Math.max(6, paragraph.fontSize);
  const columns = Math.max(1, paragraph.columns);
  const columnGap = Math.max(0, (columns - 1) * paragraph.columnGap * fontSize);
  const columnWidth = Math.max(72, (widthPoints - columnGap) / columns);
  const leading = Math.max(9, fontSize * paragraph.lineHeight);
  const averageCharacterWidth = Math.max(3, fontSize * 0.49 + Math.max(0, paragraph.letterSpacing) * fontSize);
  const charactersPerLine = Math.max(18, Math.floor(columnWidth / averageCharacterWidth));
  const wordsPerLine = Math.max(3, charactersPerLine / 5.2);
  const linesPerPage = Math.max(10, Math.floor(heightPoints / leading));
  const paragraphSpacing = Math.max(0, paragraph.spaceBefore + paragraph.spaceAfter);
  const spacingFactor = Math.max(0.72, 1 - paragraphSpacing / 18);
  return Math.max(40, Math.floor(linesPerPage * wordsPerLine * columns * 0.9 * spacingFactor));
}

function pagesForSection(words: number, capacity: number, hasTitle: boolean) {
  const titleAllowance = hasTitle ? Math.max(20, Math.round(capacity * 0.06)) : 0;
  return Math.max(1, Math.ceil((words + titleAllowance) / capacity));
}

function chapterSection(book: Book, chapter: Chapter, capacity: number): BookPaginationSection {
  const layout = layoutForChapter(book, chapter);
  const sectionCapacity = wordsPerPage(book.trim_size, layout);
  const words = wordCount(chapter.content);
  return {
    id: `chapter:${chapter.id}`,
    chapterId: chapter.id,
    label: chapter.title.trim() || "Untitled section",
    band: chapterPageBand(chapter),
    words,
    estimatedPages: pagesForSection(words, sectionCapacity || capacity, Boolean(chapter.title.trim())),
  };
}

function matterSection(key: string, title: string, content: string, band: PageBand, capacity: number): BookPaginationSection {
  const words = wordCount(content);
  return {
    id: `matter:${key}`,
    label: title,
    band,
    words,
    estimatedPages: pagesForSection(words, capacity, true),
  };
}

/**
 * Estimate interior pages from the selected trim, margins, body type, columns,
 * section overrides, and generated contents. This is a planning signal, not a
 * substitute for the browser or system print engine's final pagination.
 */
export function estimateBookPagination(book: Book, chapters: Chapter[]): BookPaginationEstimate {
  const baseLayout = layoutForBook(book);
  const capacity = wordsPerPage(book.trim_size, baseLayout);
  const sections: BookPaginationSection[] = [];

  for (const section of frontMatterSections(book, chapters)) {
    sections.push(matterSection(section.key, section.title, section.content, "opening", capacity));
  }

  const contentsEntries = buildBookToc(book, chapters).length;
  if (book.toc_enabled && contentsEntries > 0) {
    sections.push({
      id: "contents",
      label: book.toc_title.trim() || "Contents",
      band: "contents",
      words: contentsEntries,
      estimatedPages: Math.max(1, Math.ceil(contentsEntries / 28)),
    });
  }

  for (const chapter of orderBookChapters(chapters)) {
    sections.push(chapterSection(book, chapter, capacity));
  }

  for (const section of backMatterSections(book, chapters)) {
    sections.push(matterSection(section.key, section.title, section.content, "closing", capacity));
  }

  return {
    estimatedPages: sections.reduce((total, section) => total + section.estimatedPages, 0),
    textCapacity: capacity,
    sections,
  };
}
