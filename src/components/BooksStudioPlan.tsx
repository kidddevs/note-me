import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, CalendarClock, CheckCheck, FilterX, Plus, Search, Target, X } from "lucide-react";
import type { Book, Chapter, ChapterWorkflowStatus } from "../lib/types";
import { chapterKindLabel } from "../lib/bookPublishing";
import { CHAPTER_WORKFLOW_STATUSES, chapterPlanEntries, chapterPlanSummary, filterChapterPlan, localDateKey, type ChapterPlanSort } from "../lib/bookWorkflow";
import { ChapterWorkflowBadge, ChapterWorkflowEditor } from "./BookWorkflowControls";

function dueLabel(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

export function PlanScreen({ book, chapters, activeChapterId, onOpenChapter, onNewChapter }: { book: Book; chapters: Chapter[]; activeChapterId: number | null; onOpenChapter: (id: number) => void; onNewChapter: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(activeChapterId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ChapterWorkflowStatus | "all">("all");
  const [group, setGroup] = useState<"front" | "story" | "back" | "all">("all");
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState<ChapterPlanSort>("document");
  const [today, setToday] = useState(localDateKey);
  const screenRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const refresh = () => setToday(localDateKey());
    const timer = window.setInterval(refresh, 60_000); window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => { setSelectedId(activeChapterId); setQuery(""); setStatus("all"); setGroup("all"); setOverdue(false); }, [book.id]);
  const entries = useMemo(() => chapterPlanEntries(chapters, today), [chapters, today]);
  const summary = useMemo(() => chapterPlanSummary(entries, book), [entries, book.word_goal]);
  const filtered = useMemo(() => filterChapterPlan(entries, { query, status, group, overdue, sort }), [entries, query, status, group, overdue, sort]);
  const selected = filtered.find((entry) => entry.chapter.id === selectedId) ?? filtered[0];
  const select = (id: number) => {
    setSelectedId(id);
    if (screenRef.current && screenRef.current.clientWidth <= 820) requestAnimationFrame(() => {
      inspectorRef.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  };
  const reset = () => { setQuery(""); setStatus("all"); setGroup("all"); setOverdue(false); setSort("document"); };

  return <section ref={screenRef} className="books-plan-screen" aria-labelledby="books-plan-title">
    <header className="books-plan-heading"><div><span className="books-eyebrow">Editorial workspace</span><h1 id="books-plan-title">Section plan</h1><p>{book.title || "Untitled manuscript"} <span>Plan the writing, then return to the page.</span></p></div><button type="button" className="books-primary-action" onClick={onNewChapter}><Plus size={15} /> New section</button></header>
    <div className="books-plan-summary">
      <div><BookOpen size={18} /><span><strong>{summary.sections}</strong><small>manuscript sections</small></span></div>
      <button type="button" onClick={() => { setStatus(status === "ready" ? "all" : "ready"); setOverdue(false); }} aria-pressed={status === "ready"}><CheckCheck size={18} /><span><strong>{summary.ready} / {summary.sections}</strong><small>sections marked ready</small></span></button>
      <div><Target size={18} /><span><strong>{summary.plannedWords.toLocaleString()}</strong><small>words budgeted · {summary.budgetedSections} {summary.budgetedSections === 1 ? "section" : "sections"}{summary.bookGoal ? ` / ${summary.bookGoal.toLocaleString()} book goal` : ""}</small></span></div>
      <button type="button" className={summary.overdue ? "has-overdue" : ""} onClick={() => { setOverdue((value) => !value); setStatus("all"); }} aria-pressed={overdue}><CalendarClock size={18} /><span><strong>{summary.overdue}</strong><small>past their due date</small></span></button>
    </div>
    <div className="books-plan-toolbar">
      <label className="books-plan-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search section plan" placeholder="Search titles, types or writing" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear plan search"><X size={13} /></button>}</label>
      <select aria-label="Filter section status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option>{CHAPTER_WORKFLOW_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <select aria-label="Filter section group" value={group} onChange={(event) => setGroup(event.target.value as typeof group)}><option value="all">Whole manuscript</option><option value="front">Opening pages</option><option value="story">Story & features</option><option value="back">Closing pages</option></select>
      <select aria-label="Sort section plan" value={sort} onChange={(event) => setSort(event.target.value as ChapterPlanSort)}><option value="document">Document order</option><option value="due">Due date</option><option value="title">Title</option><option value="words">Word count</option></select>
      {(overdue || query || status !== "all" || group !== "all") && <button type="button" className="books-plan-reset" onClick={reset}><FilterX size={14} /> Clear filters</button>}
    </div>
    <div className={`books-plan-body ${selected ? "" : "no-selection"}`}><div className="books-plan-collection">
      <p className="books-plan-results" aria-live="polite">{filtered.length} of {entries.length} sections{overdue ? " · past due" : ""}<span>{summary.words.toLocaleString()} manuscript words</span></p>
      {!filtered.length && <div className="books-plan-empty"><BookOpen size={30} /><h2>{entries.length ? "No matching sections" : "Start planning your manuscript"}</h2><p>{entries.length ? "Clear a filter or try another search." : "Add a section, then give it a word budget or a due date."}</p><button type="button" onClick={entries.length ? reset : onNewChapter}>{entries.length ? "Show all sections" : "Create a section"}</button></div>}
      <div className="books-plan-grid">{filtered.map((entry) => <article key={entry.chapter.id} className={`books-plan-card ${entry.chapter.id === selected?.chapter.id ? "selected" : ""}`}>
        <button type="button" className="books-plan-card-main" onClick={() => select(entry.chapter.id)} aria-pressed={entry.chapter.id === selected?.chapter.id} aria-label={`Plan ${entry.chapter.title || "Untitled section"}`}>
          <span className="books-plan-card-top"><span>{String(entry.ordinal + 1).padStart(2, "0")} <span>{chapterKindLabel(entry.chapter.chapter_kind)}</span></span><ChapterWorkflowBadge chapter={entry.chapter} /></span>
          <strong>{entry.chapter.title || "Untitled section"}</strong><span className="books-plan-excerpt">{entry.excerpt || "An unwritten section, ready for a first idea."}</span>
          <span className="books-plan-word-label"><b>{entry.words.toLocaleString()}</b>{entry.workflow.wordGoal ? ` / ${entry.workflow.wordGoal.toLocaleString()} words` : " words · no budget"}</span>
          {entry.progress !== null && <span className="books-plan-progress" role="progressbar" aria-label={`${entry.chapter.title || "Section"} word budget`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={entry.progress}><span style={{ width: `${entry.progress}%` }} /></span>}
        </button>
        <footer><span className={entry.overdue ? "overdue" : entry.dueToday ? "due-today" : ""}><CalendarClock size={12} />{entry.workflow.dueDate ? `${entry.overdue ? "Past due · " : entry.dueToday ? "Today · " : ""}${dueLabel(entry.workflow.dueDate)}` : "No due date"}</span><button type="button" onClick={() => onOpenChapter(entry.chapter.id)} aria-label={`Write ${entry.chapter.title || "Untitled section"}`}>Write <ArrowRight size={13} /></button></footer>
      </article>)}</div>
    </div>{selected && <aside ref={inspectorRef} className="books-plan-inspector" aria-label="Selected section plan"><header><span className="books-eyebrow">Section details</span><h2 tabIndex={-1}>{selected.chapter.title || "Untitled section"}</h2><p>{chapterKindLabel(selected.chapter.chapter_kind)} · {selected.words.toLocaleString()} words</p></header><ChapterWorkflowEditor key={`${book.id}:${selected.chapter.id}`} chapter={selected.chapter} /><button type="button" className="books-plan-write" onClick={() => onOpenChapter(selected.chapter.id)}>Open in manuscript <ArrowRight size={14} /></button></aside>}</div>
  </section>;
}
