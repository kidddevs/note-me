import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CaseSensitive, ClipboardList, Download, Heading, ListTree, Search, WholeWord, X } from "lucide-react";
import type { Chapter } from "../lib/types";
import { chapterKindLabel, wordCount } from "../lib/bookPublishing";
import { manuscriptSections, searchBookManuscript, type ManuscriptDestination } from "../lib/bookManuscriptNavigation";
import type { ManuscriptSearchOptions } from "../lib/bookManuscriptSearch";
import { ChapterWorkflowBadge } from "./BookWorkflowControls";

export function ManuscriptNavigator({ open, mode, onModeChange, chapters, activeChapterId, onOpen, onPlan, onExport, onClose }: {
  open: boolean;
  mode: "sections" | "search";
  onModeChange: (mode: "sections" | "search") => void;
  chapters: Chapter[];
  activeChapterId: number;
  onOpen: (chapterId: number, destination: ManuscriptDestination) => Promise<void>;
  onPlan: () => Promise<void>;
  onExport: () => Promise<void>;
  onClose: () => void;
}) {
  const [sectionQuery, setSectionQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const query = mode === "sections" ? sectionQuery : searchQuery;
  const setQuery = mode === "sections" ? setSectionQuery : setSearchQuery;
  const [options, setOptions] = useState<ManuscriptSearchOptions>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deferredQuery = useDeferredValue(query);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const restoreFocusRef = useRef(true);
  const sections = useMemo(() => open && mode === "sections" ? manuscriptSections(chapters, deferredQuery) : [], [open, mode, chapters, deferredQuery]);
  const search = useMemo(() => open && mode === "search" ? searchBookManuscript(chapters, deferredQuery, options) : { sections: [], total: 0, shown: 0 }, [open, mode, chapters, deferredQuery, options]);
  const updating = deferredQuery !== query;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = true;
    setError("");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => { if (restoreFocusRef.current && previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);

  const activate = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    restoreFocusRef.current = false;
    try { await action(); onClose(); }
    catch (error) { restoreFocusRef.current = true; setError(`Could not leave this section. ${String(error)}`); }
    finally { busyRef.current = false; setBusy(false); }
  };

  if (!open) return null;
  return <div className="books-navigator-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !busyRef.current) onClose(); }}>
    <section className="books-navigator" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="books-navigator-title" aria-busy={busy} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); if (!busyRef.current) onClose(); return; }
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex="0"]') ?? []);
      if (event.key === "Tab") {
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const rows = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-navigator-result]:not(:disabled)') ?? []);
        if (!rows.length) return;
        const index = rows.indexOf(document.activeElement as HTMLButtonElement);
        const next = index < 0 ? (event.key === "ArrowDown" ? 0 : rows.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
        event.preventDefault(); rows[next].focus();
      }
      if (event.key === "Enter" && event.target === inputRef.current) {
        event.preventDefault(); panelRef.current?.querySelector<HTMLButtonElement>('[data-navigator-result]:not(:disabled)')?.click();
      }
    }}>
      <header><div><span className="books-eyebrow"><ListTree size={14} /> Writing workspace</span><h2 id="books-navigator-title">Manuscript navigator</h2><p>Jump to a section, heading or passage.</p></div><button type="button" className="books-quiet-button" onClick={onClose} disabled={busy} aria-label="Close manuscript navigator"><X size={18} /></button></header>
      <div className="books-navigator-tools">
        <div className="books-navigator-modes" role="group" aria-label="Navigator mode">
          <button type="button" aria-pressed={mode === "sections"} onClick={() => onModeChange("sections")}><ListTree size={15} /> Sections & headings</button>
          <button type="button" aria-pressed={mode === "search"} onClick={() => onModeChange("search")}><Search size={15} /> Find in book</button>
        </div>
        <label className="books-navigator-search"><Search size={16} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={mode === "search" ? "Search manuscript prose" : "Filter sections and headings"} placeholder={mode === "search" ? "Search prose across all sections" : "Find a section or heading"} />{query && <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear navigator search"><X size={14} /></button>}</label>
        {mode === "search" && <div className="books-navigator-search-options">
          <button type="button" aria-pressed={Boolean(options.matchCase)} onClick={() => setOptions((value) => ({ ...value, matchCase: !value.matchCase }))}><CaseSensitive size={15} /> Match case</button>
          <button type="button" aria-pressed={Boolean(options.wholeWord)} onClick={() => setOptions((value) => ({ ...value, wholeWord: !value.wholeWord }))}><WholeWord size={15} /> Whole words</button>
          <span>Opens section find for editing.</span>
        </div>}
      </div>
      {error && <p className="books-navigator-error" role="alert">{error} Your draft remains open.</p>}
      <p className="books-navigator-count" role="status">{busy ? "Saving before navigation…" : updating ? "Updating results…" : mode === "sections" ? `${sections.length} of ${chapters.length} sections` : !query.trim() ? "Search writing, including the current unsaved draft." : `${search.total} ${search.total === 1 ? "match" : "matches"} in ${search.sections.length} ${search.sections.length === 1 ? "section" : "sections"}`}</p>
      <div className="books-navigator-results" aria-label="Manuscript locations" aria-busy={updating}>
        {mode === "sections" ? sections.map(({ chapter, headings }) => <section key={chapter.id}>
          <button type="button" className="books-navigator-section" data-navigator-result aria-current={chapter.id === activeChapterId ? "location" : undefined} disabled={busy || updating} onClick={() => void activate(() => onOpen(chapter.id, { kind: "title" }))}><BookOpen size={17} /><span><strong>{chapter.title || "Untitled section"}</strong><small>{chapterKindLabel(chapter.chapter_kind)} · {wordCount(chapter.content).toLocaleString()} words{chapter.toc_include === false ? " · Outside contents" : ""}</small></span><ChapterWorkflowBadge chapter={chapter} /></button>
          {headings.map((heading) => <button type="button" key={heading.key} className="books-navigator-heading" data-navigator-result style={{ paddingInlineStart: 24 + Math.min(5, heading.level - 1) * 14 }} disabled={busy || updating} onClick={() => void activate(() => onOpen(chapter.id, { kind: "heading", key: heading.key }))}><Heading size={14} /><span>{heading.label}</span><small>H{heading.level}</small></button>)}
        </section>) : search.sections.filter((section) => section.matches.length).map(({ chapter, count, matches }) => <section key={chapter.id} className="books-navigator-match-group">
          <h3>{chapter.title || "Untitled section"}<small>{count} {count === 1 ? "match" : "matches"}</small></h3>
          {matches.map((match) => { const { excerpt } = match; return <button type="button" key={match.start} className="books-navigator-match" data-navigator-result disabled={busy || updating} onClick={() => void activate(() => onOpen(chapter.id, { kind: "search", query: deferredQuery, options: { ...options }, start: match.start, source: chapter.content }))}>{excerpt ? <span>{excerpt.before}<mark>{excerpt.match}</mark>{excerpt.after}</span> : <span>Open matching passage</span>}</button>; })}
        </section>)}
        {((mode === "sections" && !sections.length) || (mode === "search" && !search.total)) && <div className="books-navigator-empty"><Search size={26} /><p>{query.trim() ? "No matching writing. Try another phrase or change the search options." : mode === "search" ? "Enter a phrase to find it throughout your manuscript." : "Add a section to start writing."}</p></div>}
        {mode === "search" && search.total > search.shown && <p className="books-navigator-limit">Showing the first {search.shown} of {search.total} matches. Refine your search to see a smaller set.</p>}
      </div>
      <footer><span>↑ ↓ navigate · Enter open · Esc close</span><div><button type="button" disabled={busy} onClick={() => void activate(onPlan)}><ClipboardList size={15} /> Section plan</button><button type="button" disabled={busy} onClick={() => void activate(onExport)}><Download size={15} /> Export studio</button></div></footer>
    </section>
  </div>;
}
