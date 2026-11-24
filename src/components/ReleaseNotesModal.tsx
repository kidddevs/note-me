import { ArrowRight, BookOpen, Check, FileText, PenLine, Sparkles, Type, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { CURRENT_RELEASE_NOTES } from "../lib/releaseNotes";

const HIGHLIGHT_ICONS = {
  pen: PenLine,
  type: Type,
  publish: FileText,
} as const;

export function ReleaseNotesModal({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
    ));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="boot-overlay release-notes-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-notes-title"
      aria-describedby="release-notes-description"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="release-notes-card">
        <div className="release-notes-topline">
          <span className="release-notes-kicker"><Sparkles size={13} /> {CURRENT_RELEASE_NOTES.eyebrow}</span>
          <span className="release-notes-version">v{CURRENT_RELEASE_NOTES.version}</span>
          <button ref={closeButtonRef} className="release-notes-close" type="button" onClick={onClose} title="Close release notes" aria-label="Close release notes">
            <X size={16} />
          </button>
        </div>
        <div className="release-notes-body">
          <div className="release-notes-intro">
            <div className="release-notes-mark"><BookOpen size={22} /></div>
            <div>
              <h1 id="release-notes-title">{CURRENT_RELEASE_NOTES.title}</h1>
              <p id="release-notes-description">{CURRENT_RELEASE_NOTES.summary}</p>
            </div>
          </div>
          <div className="release-notes-list">
            {CURRENT_RELEASE_NOTES.highlights.map((highlight) => {
              const Icon = HIGHLIGHT_ICONS[highlight.icon];
              return (
                <article className="release-notes-item" key={highlight.title}>
                  <span className="release-notes-item-icon"><Icon size={15} /></span>
                  <div><strong>{highlight.title}</strong><p>{highlight.detail}</p></div>
                  <Check size={14} className="release-notes-item-check" aria-hidden="true" />
                </article>
              );
            })}
          </div>
        </div>
        <footer className="release-notes-footer">
          <span>Built for focused, local-first work.</span>
          <button className="btn primary small" type="button" onClick={onClose}>Continue writing <ArrowRight size={14} /></button>
        </footer>
      </div>
    </div>
  );
}
