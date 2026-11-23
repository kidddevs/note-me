import type { Chapter } from "./types";
import { canvasBlocks } from "./bookPublishing";
import { extractMarkdownHeadings, orderBookChapters, sectionAnchorId } from "./bookToc";
import { findManuscriptMatches, manuscriptMatchExcerpts, type ManuscriptSearchOptions } from "./bookManuscriptSearch";

export type ManuscriptDestination = { kind: "title" }
  | { kind: "heading"; key: string }
  | { kind: "search"; query: string; options: ManuscriptSearchOptions; start: number; source: string };

export interface ManuscriptLocation {
  bookId: number;
  chapterId: number;
  destination: ManuscriptDestination;
}

/** Search ordered manuscript prose, retaining exact counts while bounding rendered rows. */
export function searchBookManuscript(chapters: Chapter[], query: string, options: ManuscriptSearchOptions = {}, limit = 200) {
  const maximum = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 200;
  let total = 0, shown = 0;
  const sections = orderBookChapters(chapters).flatMap((chapter) => {
    const matches = findManuscriptMatches(chapter.content, query, options);
    total += matches.length;
    const visible = matches.slice(0, Math.max(0, maximum - shown));
    shown += visible.length;
    const excerpts = visible.length ? manuscriptMatchExcerpts(chapter.content, visible) : [];
    return matches.length ? [{ chapter, count: matches.length, matches: visible.map((match, index) => ({ ...match, excerpt: excerpts[index] })) }] : [];
  });
  return { sections, total, shown };
}

/** Resolve headings by identity and search results against the current revision. */
export function resolveManuscriptDestination(content: string, destination: ManuscriptDestination) {
  const blocks = canvasBlocks(content);
  if (destination.kind === "title") return { block: null, findIndex: 0, stale: false };
  if (destination.kind === "heading") {
    const heading = extractMarkdownHeadings(content, "navigation").find((item) => item.key === destination.key);
    const block = heading ? blocks.find((item) => item.kind === "text" && item.start <= heading.start && item.end > heading.start) ?? null : null;
    return { block, findIndex: 0, stale: !block };
  }
  const matches = findManuscriptMatches(content, destination.query, destination.options);
  const unchanged = content === destination.source;
  const index = unchanged ? matches.findIndex((match) => match.start === destination.start) : -1;
  const findIndex = Math.max(0, index);
  const match = matches[findIndex];
  const block = match ? blocks.find((item) => item.kind === "text" && item.start === match.blockStart) ?? null : null;
  return { block, findIndex, stale: index < 0 };
}

/** Includes headings omitted from reader contents; navigating never changes inclusion. */
export function manuscriptSections(chapters: Chapter[], query = "") {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return orderBookChapters(chapters).flatMap((chapter) => {
    const headings = extractMarkdownHeadings(chapter.content, sectionAnchorId(chapter.id));
    const matches = (text: string) => terms.every((term) => text.toLocaleLowerCase().includes(term));
    const sectionMatches = matches(`${chapter.title} ${chapter.chapter_kind.replace(/_/g, " ")}`);
    const visible = sectionMatches ? headings : headings.filter((heading) => matches(heading.label));
    return sectionMatches || visible.length ? [{ chapter, headings: visible }] : [];
  });
}
