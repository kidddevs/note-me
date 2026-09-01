import type { Book, Chapter } from "./types";

export type TocEntrySource = "section" | "heading" | "matter";

export interface TocEntry {
  id: string;
  label: string;
  level: number;
  source: TocEntrySource;
  chapterId?: number;
  matterKey?: string;
  headingLevel?: number;
  headingKey?: string;
  included?: boolean;
}

export interface BookMatterSection {
  key: "dedication" | "epigraph" | "copyright" | "acknowledgements";
  title: string;
  content: string;
  group: "front" | "back";
}

const KIND_LABELS: Record<string, string> = {
  title_page: "Title page",
  dedication: "Dedication",
  epigraph: "Epigraph",
  copyright: "Copyright",
  prologue: "Prologue",
  chapter: "Chapter",
  interlude: "Interlude",
  appendix: "Appendix",
  acknowledgements: "Acknowledgements",
  about_author: "About the author",
};

export function orderBookChapters(chapters: Chapter[]) {
  const groupOrder: Record<"front" | "story" | "back", number> = { front: 0, story: 1, back: 2 };
  const groupForKind = (kind: string) => kind === "title_page" || kind === "dedication" || kind === "epigraph" || kind === "copyright" ? "front" : kind === "appendix" || kind === "acknowledgements" || kind === "about_author" ? "back" : "story";
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .sort((left, right) => groupOrder[groupForKind(left.chapter.chapter_kind)] - groupOrder[groupForKind(right.chapter.chapter_kind)] || left.index - right.index)
    .map(({ chapter }) => chapter);
}

export function frontMatterSections(book: Book, chapters: Chapter[] = []): BookMatterSection[] {
  const persistedKinds = new Set(chapters.map((chapter) => chapter.chapter_kind));
  const sections: BookMatterSection[] = [
    { key: "dedication", title: "Dedication", content: book.dedication, group: "front" },
    { key: "epigraph", title: "Epigraph", content: book.epigraph, group: "front" },
    { key: "copyright", title: "Copyright", content: book.copyright_text, group: "front" },
  ];
  return sections.filter((section) => section.content.trim() && !persistedKinds.has(section.key));
}

export function backMatterSections(book: Book, chapters: Chapter[] = []): BookMatterSection[] {
  const persistedKinds = new Set(chapters.map((chapter) => chapter.chapter_kind));
  const sections: BookMatterSection[] = [
    { key: "acknowledgements", title: "Acknowledgements", content: book.acknowledgements, group: "back" },
  ];
  return sections.filter((section) => section.content.trim() && !persistedKinds.has(section.key));
}

export function sectionAnchorId(chapterId: number) {
  return `section-${chapterId}`;
}

export function matterAnchorId(key: string) {
  return `matter-${key}`;
}

export function headingAnchorId(prefix: string, ordinal: number) {
  return `${prefix}-heading-${ordinal}`;
}

export interface MarkdownHeading {
  level: number;
  label: string;
  ordinal: number;
  id: string;
  key: string;
}

function plainHeading(value: string) {
  return value
    .replace(/\s+#+\s*$/, "")
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
}

interface MarkdownFence {
  marker: "`" | "~";
  length: number;
}

function fenceRun(line: string) {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  return match ? { run: match[1], rest: match[2] } : null;
}

function nextFence(line: string, current: MarkdownFence | null) {
  const candidate = fenceRun(line);
  if (!candidate) return current;
  const marker = candidate.run[0] as MarkdownFence["marker"];
  if (!current) return { marker, length: candidate.run.length };
  const isClosing = marker === current.marker
    && candidate.run.length >= current.length
    && candidate.rest.trim() === "";
  return isClosing ? null : current;
}

export function extractMarkdownHeadings(markdown: string, prefix: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  let fence: MarkdownFence | null = null;
  let ordinal = 0;
  const occurrences = new Map<string, number>();

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const updatedFence = nextFence(line, fence);
    if (updatedFence !== fence) {
      fence = updatedFence;
      continue;
    }
    if (fence) continue;

    const match = /^ {0,3}(#{1,6})[\t ]+(.+)$/.exec(line);
    if (!match) continue;
    ordinal += 1;
    const label = plainHeading(match[2]);
    if (!label) continue;
    const level = match[1].length;
    const occurrenceKey = `${level}:${label}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    headings.push({
      level,
      label,
      ordinal,
      id: headingAnchorId(prefix, ordinal),
      key: JSON.stringify([level, label, occurrence]),
    });
  }

  return headings;
}

function chapterLabel(chapter: Chapter, chapterNumber: number) {
  const title = chapter.title.trim();
  if (title) return title;
  return chapter.chapter_kind === "chapter"
    ? `Chapter ${chapterNumber}`
    : KIND_LABELS[chapter.chapter_kind] ?? "Untitled section";
}

function addSectionEntries(
  entries: TocEntry[],
  section: { id: string; title: string; content: string; chapterId?: number; matterKey?: string; headingExclusions?: string[] },
  depth: number,
  source: "section" | "matter",
  includeExcludedHeadings: boolean,
) {
  entries.push({
    id: section.id,
    label: section.title,
    level: 1,
    source,
    chapterId: section.chapterId,
    matterKey: section.matterKey,
  });

  if (depth < 1) return;
  const excludedHeadings = new Set(section.headingExclusions ?? []);
  const headings = extractMarkdownHeadings(section.content, section.id);
  for (const heading of headings) {
    if (heading.level > depth || (!includeExcludedHeadings && excludedHeadings.has(heading.key))) continue;
    entries.push({
      id: heading.id,
      label: heading.label,
      level: heading.level + 1,
      source: "heading",
      chapterId: section.chapterId,
      matterKey: section.matterKey,
      headingLevel: heading.level,
      headingKey: heading.key,
      included: !excludedHeadings.has(heading.key),
    });
  }
}

export function buildBookToc(book: Book, chapters: Chapter[], options: { includeExcludedHeadings?: boolean } = {}): TocEntry[] {
  if (book.toc_enabled === false) return [];

  const entries: TocEntry[] = [];
  const depth = Math.max(0, Math.min(6, book.toc_depth ?? 3));
  const includeExcludedHeadings = options.includeExcludedHeadings ?? false;

  if (book.toc_include_front_matter !== false) {
    for (const section of frontMatterSections(book, chapters)) {
      addSectionEntries(entries, { ...section, id: matterAnchorId(section.key), matterKey: section.key }, depth, "matter", includeExcludedHeadings);
    }
  }

  let chapterNumber = 0;
  for (const chapter of orderBookChapters(chapters)) {
    if (chapter.chapter_kind === "chapter") chapterNumber += 1;
    if (chapter.toc_include === false) continue;
    addSectionEntries(
      entries,
      {
        id: sectionAnchorId(chapter.id),
        title: chapterLabel(chapter, chapterNumber),
        content: chapter.content,
        chapterId: chapter.id,
        headingExclusions: chapter.toc_heading_exclusions,
      },
      depth,
      "section",
      includeExcludedHeadings,
    );
  }

  if (book.toc_include_back_matter !== false) {
    for (const section of backMatterSections(book, chapters)) {
      addSectionEntries(entries, { ...section, id: matterAnchorId(section.key), matterKey: section.key }, depth, "matter", includeExcludedHeadings);
    }
  }

  return entries;
}

export function addMarkdownHeadingAnchors(markdown: string, prefix: string) {
  let fence: MarkdownFence | null = null;
  let ordinal = 0;
  return markdown.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const updatedFence = nextFence(line, fence);
    if (updatedFence !== fence) {
      fence = updatedFence;
      return line;
    }
    if (fence) return line;
    if (!/^ {0,3}(#{1,6})[\t ]+(.+)$/.test(line)) return line;
    ordinal += 1;
    return `<a id="${headingAnchorId(prefix, ordinal)}"></a>\n${line}`;
  }).join("\n");
}
