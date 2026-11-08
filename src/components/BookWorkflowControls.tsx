import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, CheckCheck, LoaderCircle, NotebookPen, RefreshCw, Save, X } from "lucide-react";
import type { Chapter, ChapterWorkflow, ChapterWorkflowStatus } from "../lib/types";
import { CHAPTER_WORKFLOW_STATUSES, MAX_SECTION_WORD_GOAL, chapterWorkflowError, parseChapterWorkflow, serializeChapterWorkflow } from "../lib/bookWorkflow";
import { useBooks } from "../store/books";

const STATUS_ICONS = { draft: NotebookPen, revising: RefreshCw, ready: CheckCheck };
export function ChapterStatusIcon({ status, size = 13 }: { status: ChapterWorkflowStatus; size?: number }) {
  const Icon = STATUS_ICONS[status];
  return <Icon size={size} />;
}

export function ChapterWorkflowBadge({ chapter }: { chapter: Chapter }) {
  const workflow = parseChapterWorkflow(chapter.workflow_json);
  return <span className={`book-workflow-badge ${workflow.status}`} aria-label={`Section status: ${workflow.status}`}><ChapterStatusIcon status={workflow.status} />{CHAPTER_WORKFLOW_STATUSES.find((item) => item.value === workflow.status)?.label}</span>;
}

export function ChapterWorkflowEditor({ chapter }: { chapter: Chapter }) {
  const saveWorkflow = useBooks((state) => state.updateChapterWorkflow);
  const initial = parseChapterWorkflow(chapter.workflow_json);
  const [status, setStatus] = useState(initial.status);
  const [goal, setGoal] = useState(initial.wordGoal ? String(initial.wordGoal) : "");
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [baseline, setBaseline] = useState(serializeChapterWorkflow(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const statusName = useId();
  const goalHelpId = useId();
  const dueHelpId = useId();
  const persisted = serializeChapterWorkflow(parseChapterWorkflow(chapter.workflow_json));
  const draft: ChapterWorkflow = { status, wordGoal: goal.trim() ? Number(goal) : 0, dueDate };
  const dirty = JSON.stringify(draft) !== baseline;
  const changedElsewhere = baseline !== persisted && dirty;

  const reload = () => {
    const next = parseChapterWorkflow(chapter.workflow_json);
    setStatus(next.status); setGoal(next.wordGoal ? String(next.wordGoal) : ""); setDueDate(next.dueDate);
    setBaseline(serializeChapterWorkflow(next)); setError(""); setSaved(false);
  };
  useEffect(() => {
    if (!dirty) {
      const next = parseChapterWorkflow(chapter.workflow_json);
      setStatus(next.status); setGoal(next.wordGoal ? String(next.wordGoal) : ""); setDueDate(next.dueDate); setBaseline(persisted);
    }
  }, [dirty, persisted]);

  const save = async () => {
    if (busy) return;
    const problem = chapterWorkflowError(draft);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(""); setSaved(false);
    try { await saveWorkflow(chapter.id, draft); setBaseline(serializeChapterWorkflow(draft)); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  return <form className="book-workflow-editor" aria-label={`Plan for ${chapter.title || "Untitled section"}`} onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <fieldset disabled={busy}><legend>Editorial status</legend><div className="book-workflow-statuses">
      {CHAPTER_WORKFLOW_STATUSES.map((item) => <label key={item.value} className={status === item.value ? "active" : ""}><input type="radio" name={statusName} value={item.value} checked={status === item.value} onChange={() => { setStatus(item.value); setSaved(false); }} /><ChapterStatusIcon status={item.value} /><span>{item.label}</span></label>)}
    </div></fieldset>
    <label className="book-workflow-field"><span>Word budget</span><input aria-label="Word budget" aria-describedby={goalHelpId} type="number" min={0} max={MAX_SECTION_WORD_GOAL} step={1} value={goal} placeholder="No budget" disabled={busy} onChange={(event) => { setGoal(event.target.value); setSaved(false); }} /><small id={goalHelpId}>Leave blank for an open-ended section.</small></label>
    <label className="book-workflow-field"><span>Due date</span><input aria-label="Due date" aria-describedby={dueHelpId} type="date" min="1000-01-01" max="9999-12-31" value={dueDate} disabled={busy} onChange={(event) => { setDueDate(event.target.value); setSaved(false); }} /><small id={dueHelpId}>Uses your local calendar day. Ready sections are never overdue.</small></label>
    {changedElsewhere && <div className="book-workflow-conflict"><AlertTriangle size={14} /><span>The saved plan changed while you were editing.</span><button type="button" onClick={reload} disabled={busy}>Reload saved</button></div>}
    {error && <p className="book-workflow-error" role="alert"><AlertTriangle size={14} />{error}</p>}
    <div className="book-workflow-save"><button type="submit" disabled={busy || !dirty}>{busy ? <LoaderCircle size={14} className="cover-tool-busy" /> : saved || !dirty ? <Check size={14} /> : <Save size={14} />}{busy ? "Saving plan" : saved ? "Plan saved" : "Save section plan"}</button><span role="status">{dirty ? "Unsaved plan" : "Saved locally"}</span></div>
    <p className="book-workflow-note">Planning stays with this section. It is separate from the book's publication status and reader exports.</p>
  </form>;
}

/** The same planning form is available without leaving the writing surface. */
export function ChapterWorkflowPopover({ chapter }: { chapter: Chapter }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 330 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const workflow = parseChapterWorkflow(chapter.workflow_json);
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(350, window.innerWidth - 24);
      const height = dialogRef.current?.offsetHeight ?? 430;
      setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top: Math.max(56, Math.min(rect.bottom + 8, window.innerHeight - height - 12)), width });
    };
    reposition(); window.addEventListener("resize", reposition); window.addEventListener("scroll", reposition, true);
    return () => { window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const outside = (event: PointerEvent) => { if (!dialogRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("pointerdown", outside); triggerRef.current?.focus({ preventScroll: true }); };
  }, [open]);
  useEffect(() => setOpen(false), [chapter.id]);
  return <>
    <button ref={triggerRef} type="button" className={`book-workflow-trigger ${workflow.status}`} aria-label={`Section plan: ${workflow.status}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}><ChapterStatusIcon status={workflow.status} /><span>{CHAPTER_WORKFLOW_STATUSES.find((item) => item.value === workflow.status)?.label}</span></button>
    {open && createPortal(<div ref={dialogRef} className="book-workflow-popover" role="dialog" aria-modal="true" aria-labelledby={titleId} style={position} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); dialogRef.current?.querySelector("form")?.requestSubmit(); }
      if (event.key === "Tab") {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}><header><div><span>Section plan</span><h2 id={titleId}>{chapter.title || "Untitled section"}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close section plan"><X size={17} /></button></header><ChapterWorkflowEditor key={chapter.id} chapter={chapter} /></div>, document.body)}
  </>;
}
