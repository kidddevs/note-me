import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BookmarkPlus, Check, Clock3, Eye, History, RotateCcw, ShieldCheck, Trash2, X } from "lucide-react";
import type { ChapterSnapshot, ChapterSnapshotReason } from "../lib/types";
import { canvasBlocks, markdownToHtml, wordCount } from "../lib/bookPublishing";

const SNAPSHOT_LABELS: Record<ChapterSnapshotReason, string> = {
  auto: "Auto checkpoint", manual: "Saved checkpoint", safety: "Before restore", restore: "Restored copy",
};

export function snapshotTime(value: string) {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function snapshotPreview(content: string) {
  const text = canvasBlocks(content).map((block) => block.kind === "text" ? block.display.replace(/[`*_~]/g, "") : block.kind)
    .join(" · ").replace(/\s+/g, " ").trim();
  return text.slice(0, 180) || "No text in this checkpoint.";
}

export function ManuscriptHistory({ title, content, saveState, snapshots, loading, saving, error, onRetry, onSave, onRestore, onDelete, onClose }: {
  title: string;
  content: string;
  saveState: "saved" | "dirty" | "saving";
  snapshots: ChapterSnapshot[];
  loading: boolean;
  saving: boolean;
  error: string;
  onRetry: () => void;
  onSave: () => void;
  onRestore: (snapshot: ChapterSnapshot) => void;
  onDelete: (snapshot: ChapterSnapshot) => void;
  onClose: () => void;
}) {
  const [previewId, setPreviewId] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const preview = snapshots.find((snapshot) => snapshot.id === previewId);
  const currentWords = wordCount(content);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const identical = (snapshot: ChapterSnapshot) => snapshot.title === title && snapshot.content === content;
  return <div className="books-history-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panelRef} className={`books-history-panel ${preview ? "has-preview" : ""}`} role="dialog" aria-modal="true" aria-labelledby="books-history-title" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="books-history-header">
        <div><span className="books-eyebrow"><Clock3 size={13} /> Local version history</span><h2 id="books-history-title">Checkpoints</h2><p>{title || "Untitled section"} · {currentWords.toLocaleString()} words in the current draft</p></div>
        <div className="books-history-header-actions">
          <button type="button" className="books-history-save" onClick={onSave} disabled={saving || loading}><BookmarkPlus size={13} />{saving ? "Saving…" : "Save checkpoint"}</button>
          <button ref={closeRef} type="button" className="books-history-close" onClick={onClose} aria-label="Close version history"><X size={15} /></button>
        </div>
      </div>
      <div className="books-history-current"><Check size={15} /><div><strong>Current draft</strong><small>{currentWords.toLocaleString()} words · {saveState === "saving" ? "saving" : saveState === "dirty" ? "unsaved changes" : "saved locally"}</small></div></div>
      {error && <div className="books-history-error" role="alert"><AlertTriangle size={15} /><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div>}
      {loading ? <div className="books-history-empty"><Clock3 size={19} /><strong>Loading checkpoints…</strong></div> : snapshots.length === 0 ? (
        <div className="books-history-empty"><History size={20} /><strong>No checkpoints yet</strong><span>Save a checkpoint now. Further versions are captured every two minutes when the section changes.</span></div>
      ) : <div className="books-history-body">
        <ol className="books-history-list">
          {snapshots.map((snapshot) => <li className={`books-history-item ${snapshot.reason}`} key={snapshot.id}>
            {snapshot.reason === "safety" ? <ShieldCheck size={14} /> : <History size={14} />}
            <div className="books-history-item-main">
              <div className="books-history-item-top"><span className={`books-history-badge ${snapshot.reason}`}>{SNAPSHOT_LABELS[snapshot.reason]}</span><time dateTime={snapshot.created_at}>{snapshotTime(snapshot.created_at)}</time></div>
              <p>{snapshotPreview(snapshot.content)}</p><small>{snapshot.title || "Untitled section"} · {snapshot.word_count.toLocaleString()} words{identical(snapshot) ? " · Matches current draft" : ""}</small>
            </div>
            <div className="books-history-item-actions">
              <button type="button" aria-label={`Preview ${snapshot.title || "Untitled section"} checkpoint`} aria-pressed={previewId === snapshot.id} onClick={() => setPreviewId(previewId === snapshot.id ? null : snapshot.id)}><Eye size={13} /> Preview</button>
              <button type="button" disabled={saving || identical(snapshot)} onClick={() => onRestore(snapshot)}><RotateCcw size={12} /> Restore</button>
              <button type="button" className="danger" disabled={saving} onClick={() => onDelete(snapshot)} title="Delete checkpoint" aria-label={`Delete checkpoint from ${snapshotTime(snapshot.created_at)}`}><Trash2 size={13} /></button>
            </div>
          </li>)}
        </ol>
        {preview && <section className="books-history-comparison" aria-label="Checkpoint comparison">
          <div className="books-history-comparison-heading"><strong>Compare drafts</strong><span>{snapshotTime(preview.created_at)} · {wordCount(preview.content).toLocaleString()} → {currentWords.toLocaleString()} words</span></div>
          <div className="books-history-drafts">
            <article><h3>Checkpoint</h3><strong>{preview.title}</strong><div className="books-history-document" dangerouslySetInnerHTML={{ __html: markdownToHtml(preview.content) }} /></article>
            <article><h3>Current draft</h3><strong>{title}</strong><div className="books-history-document" dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} /></article>
          </div>
        </section>}
      </div>}
      <p className="books-history-note"><ShieldCheck size={13} />Restoring saves your current title and content as a safety checkpoint. The latest 50 versions per section stay on this device.</p>
    </section>
  </div>;
}
