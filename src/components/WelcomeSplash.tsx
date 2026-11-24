import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Command,
  FileText,
  FolderOpen,
  PenLine,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ONBOARDING_STEPS = [
  {
    id: "capture",
    index: "01",
    eyebrow: "Notes · quick capture",
    title: "Catch the thought before it disappears.",
    description: "Use Notes for the fragments, tasks, references, and decisions that keep a project moving.",
    detailTitle: "A private scratch space",
    detail: "Quick Capture and the command palette keep the distance between an idea and a saved note very small.",
    icon: FileText,
  },
  {
    id: "shape",
    index: "02",
    eyebrow: "Books Studio · manuscript design",
    title: "Give the work a place to become real.",
    description: "When an idea grows into a manuscript, Books Studio brings writing, typography, page structure, and planning together.",
    detailTitle: "One manuscript, many decisions",
    detail: "Shape sections, tune the page, and preview the reading experience without leaving your local workspace.",
    icon: BookOpen,
  },
  {
    id: "finish",
    index: "03",
    eyebrow: "Publishing · portable handoff",
    title: "Finish with a package you can carry.",
    description: "Review the work, check its typography, and export a reader-ready edition when the manuscript is ready to leave the studio.",
    detailTitle: "Local by default, portable by design",
    detail: "HTML, EPUB, Word, Markdown, and print all start from the same saved manuscript and layout decisions.",
    icon: Upload,
  },
] as const;

type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

function OnboardingGraphic({ step }: { step: OnboardingStepId }) {
  if (step === "capture") {
    return (
      <div className="welcome-graphic welcome-graphic-capture" aria-hidden="true">
        <div className="welcome-graphic-kicker"><span>NOTES</span><span>01 / 03</span></div>
        <div className="welcome-note-window">
          <div className="welcome-window-bar"><span className="welcome-window-dot" /><span className="welcome-window-dot" /><span className="welcome-window-title">A new thought</span></div>
          <div className="welcome-note-heading"><FileText size={18} /><span>Field notes</span><small>just now</small></div>
          <div className="welcome-note-lines"><i /><i /><i className="short" /></div>
          <div className="welcome-note-task"><span><Check size={11} /></span><strong>Keep the useful part</strong><small>task</small></div>
          <div className="welcome-note-tag"><Command size={11} /><span>quick capture</span></div>
        </div>
        <div className="welcome-graphic-caption"><span className="welcome-graphic-caption-mark"><PenLine size={13} /></span><span><strong>Save the spark.</strong><small>Let the structure come later.</small></span></div>
      </div>
    );
  }

  if (step === "shape") {
    return (
      <div className="welcome-graphic welcome-graphic-shape" aria-hidden="true">
        <div className="welcome-graphic-kicker"><span>BOOKS STUDIO</span><span>02 / 03</span></div>
        <div className="welcome-page-stack"><div className="welcome-page-sheet back" /><div className="welcome-page-sheet middle" /><div className="welcome-page-sheet">
          <span className="welcome-page-kicker">A FIELD GUIDE</span>
          <strong>Make the page<br /><em>feel like yours.</em></strong>
          <span className="welcome-page-rule" />
          <div className="welcome-page-lines"><i /><i /><i /><i className="short" /></div>
          <span className="welcome-page-number">12</span>
        </div></div>
        <div className="welcome-type-card"><span className="welcome-type-icon"><BookOpen size={14} /></span><span><strong>Typography</strong><small>Regular · 12 / 16</small></span><span className="welcome-type-swatch">Aa</span></div>
        <div className="welcome-graphic-caption"><span className="welcome-graphic-caption-mark"><Sparkles size={13} /></span><span><strong>Shape the reading.</strong><small>Write and design in one place.</small></span></div>
      </div>
    );
  }

  return (
    <div className="welcome-graphic welcome-graphic-finish" aria-hidden="true">
      <div className="welcome-graphic-kicker"><span>EXPORT STUDIO</span><span>03 / 03</span></div>
      <div className="welcome-export-stack"><div className="welcome-export-file epub"><BookOpen size={18} /><span><strong>EPUB</strong><small>reader package</small></span><Check size={14} /></div><div className="welcome-export-file docx"><FileText size={18} /><span><strong>DOCX</strong><small>editable handoff</small></span><Check size={14} /></div><div className="welcome-export-file html"><FolderOpen size={18} /><span><strong>HTML</strong><small>portable preview</small></span><Check size={14} /></div></div>
      <div className="welcome-export-status"><ShieldCheck size={15} /><span><strong>Ready to carry</strong><small>Typography and page decisions checked.</small></span></div>
      <div className="welcome-graphic-caption"><span className="welcome-graphic-caption-mark"><Upload size={13} /></span><span><strong>Leave with confidence.</strong><small>Your files stay yours.</small></span></div>
    </div>
  );
}

export function WelcomeSplash({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const step = ONBOARDING_STEPS[stepIndex];
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    nextButtonRef.current?.focus();
  }, [stepIndex]);

  const goNext = () => {
    if (isLastStep) {
      onClose();
      return;
    }
    setStepIndex((value) => value + 1);
  };

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

  const Icon = step.icon;

  return (
    <div className="boot-overlay welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-noteme-title" aria-describedby="welcome-noteme-description" onKeyDown={handleKeyDown}>
      <section className="welcome-shell">
        <header className="welcome-header">
          <div className="welcome-brand">
            <span className="welcome-brand-mark"><img src="/note-me.png" alt="" /></span>
            <span><strong>NoteMe</strong><small>LOCAL-FIRST WORKSPACE</small></span>
          </div>
          <div className="welcome-progress" aria-label={`Onboarding step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}>
            <span className="welcome-progress-label">Getting started</span>
            <span className="welcome-progress-count">{step.index} / 03</span>
            <span className="welcome-progress-track"><span style={{ width: `${((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }} /></span>
          </div>
          <button className="welcome-close" type="button" onClick={onClose} title="Skip intro" aria-label="Skip intro"><X size={15} /></button>
        </header>

        <div className="welcome-content">
          <div className="welcome-copy">
            <div className="welcome-step-heading"><span className="welcome-step-index">{step.index}</span><span className="welcome-kicker"><Icon size={13} /> {step.eyebrow}</span></div>
            <h1 id="welcome-noteme-title">{step.title}</h1>
            <p className="welcome-intro" id="welcome-noteme-description">{step.description}</p>
            <div className="welcome-detail"><span className="welcome-detail-icon"><Icon size={15} /></span><span><strong>{step.detailTitle}</strong><small>{step.detail}</small></span></div>
          </div>
          <OnboardingGraphic step={step.id} />
        </div>

        <footer className="welcome-footer">
          <button className="welcome-back" type="button" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft size={14} /> Back</button>
          <span className="welcome-footer-note"><ShieldCheck size={13} /> No account. No cloud dependency.</span>
          <button ref={nextButtonRef} className="welcome-next" type="button" onClick={goNext}>{isLastStep ? "Start writing" : "Next"} <ArrowRight size={14} /></button>
        </footer>
      </section>
    </div>
  );
}
