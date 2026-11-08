import type { Book, Chapter, ChapterWorkflow, ChapterWorkflowStatus } from "./types";
import { chapterGroup, chapterKindLabel, plainTextContent, wordCount } from "./bookPublishing";
import { orderBookChapters } from "./bookToc";

export const CHAPTER_WORKFLOW_STATUSES: Array<{ value: ChapterWorkflowStatus; label: string }> = [
  { value: "draft", label: "Draft" }, { value: "revising", label: "Revising" }, { value: "ready", label: "Ready" },
];
export const MAX_SECTION_WORD_GOAL = 1_000_000;
export const DEFAULT_CHAPTER_WORKFLOW: ChapterWorkflow = { status: "draft", wordGoal: 0, dueDate: "" };

/** A local calendar day, never a UTC conversion that can move a deadline. */
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validWorkflowDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function parseChapterWorkflow(value: string | undefined): ChapterWorkflow {
  try {
    const raw = value ? JSON.parse(value) : {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CHAPTER_WORKFLOW };
    return {
      status: CHAPTER_WORKFLOW_STATUSES.some((item) => item.value === raw.status) ? raw.status : "draft",
      wordGoal: typeof raw.wordGoal === "number" && Number.isFinite(raw.wordGoal) ? Math.max(0, Math.min(MAX_SECTION_WORD_GOAL, Math.round(raw.wordGoal))) : 0,
      dueDate: typeof raw.dueDate === "string" && validWorkflowDate(raw.dueDate) ? raw.dueDate : "",
    };
  } catch { return { ...DEFAULT_CHAPTER_WORKFLOW }; }
}

/** Writes are strict; tolerant reads never repair the user's stored record. */
export function chapterWorkflowError(value: ChapterWorkflow): string | null {
  if (!CHAPTER_WORKFLOW_STATUSES.some((item) => item.value === value.status)) return "Choose Draft, Revising or Ready.";
  if (!Number.isInteger(value.wordGoal) || value.wordGoal < 0 || value.wordGoal > MAX_SECTION_WORD_GOAL) return "Use a whole word budget between 0 and 1,000,000.";
  if (typeof value.dueDate !== "string" || (value.dueDate && !validWorkflowDate(value.dueDate))) return "Choose a valid due date between years 1000 and 9999.";
  return null;
}

export function serializeChapterWorkflow(value: ChapterWorkflow) {
  const error = chapterWorkflowError(value);
  if (error) throw new Error(error);
  return JSON.stringify({ status: value.status, wordGoal: value.wordGoal, dueDate: value.dueDate });
}

export interface ChapterPlanEntry {
  chapter: Chapter;
  workflow: ChapterWorkflow;
  words: number;
  excerpt: string;
  searchText: string;
  ordinal: number;
  group: "front" | "story" | "back";
  overdue: boolean;
  dueToday: boolean;
  remaining: number;
  progress: number | null;
}

export function chapterPlanEntries(chapters: Chapter[], today = localDateKey()): ChapterPlanEntry[] {
  return orderBookChapters(chapters).map((chapter, ordinal) => {
    const workflow = parseChapterWorkflow(chapter.workflow_json);
    const words = wordCount(chapter.content);
    const text = plainTextContent(chapter.content).replace(/^#{1,6}\s+/gm, "").replace(/[*_`~]+/g, "").replace(/\s+/g, " ").trim();
    const pending = workflow.status !== "ready";
    return { chapter, workflow, words, ordinal, group: chapterGroup(chapter.chapter_kind),
      excerpt: text.slice(0, 180), searchText: `${chapter.title} ${chapterKindLabel(chapter.chapter_kind)} ${text}`.toLocaleLowerCase(),
      overdue: pending && Boolean(workflow.dueDate) && workflow.dueDate < today,
      dueToday: pending && workflow.dueDate === today,
      remaining: Math.max(0, workflow.wordGoal - words),
      progress: workflow.wordGoal ? Math.min(100, Math.round(words / workflow.wordGoal * 100)) : null,
    };
  });
}

export type ChapterPlanSort = "document" | "due" | "title" | "words";
export function filterChapterPlan(entries: ChapterPlanEntry[], options: { query?: string; status?: ChapterWorkflowStatus | "all"; group?: "front" | "story" | "back" | "all"; overdue?: boolean; sort?: ChapterPlanSort } = {}) {
  const terms = (options.query ?? "").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = entries.filter((entry) => (!options.status || options.status === "all" || entry.workflow.status === options.status)
    && (!options.group || options.group === "all" || entry.group === options.group) && (!options.overdue || entry.overdue)
    && terms.every((term) => entry.searchText.includes(term)));
  return filtered.sort((a, b) => {
    if (options.sort === "due") return (a.workflow.dueDate || "99999").localeCompare(b.workflow.dueDate || "99999") || a.ordinal - b.ordinal;
    if (options.sort === "title") return a.chapter.title.localeCompare(b.chapter.title) || a.ordinal - b.ordinal;
    if (options.sort === "words") return b.words - a.words || a.ordinal - b.ordinal;
    return a.ordinal - b.ordinal;
  });
}

export function chapterPlanSummary(entries: ChapterPlanEntry[], book: Pick<Book, "word_goal">) {
  return { sections: entries.length, words: entries.reduce((sum, entry) => sum + entry.words, 0),
    ready: entries.filter((entry) => entry.workflow.status === "ready").length,
    overdue: entries.filter((entry) => entry.overdue).length,
    plannedWords: entries.reduce((sum, entry) => sum + entry.workflow.wordGoal, 0),
    budgetedSections: entries.filter((entry) => entry.workflow.wordGoal > 0).length,
    bookGoal: Math.max(0, book.word_goal),
  };
}
