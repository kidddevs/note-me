import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Camera,
  FileText,
  ImagePlus,
  LayoutTemplate,
  Palette,
  Printer,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import type { Book, Chapter } from "../lib/types";
import { layoutForBook, serializeBookLayout, type BookCoverLine, type BookCoverTemplate, type BookLayout } from "../lib/bookLayout";
import { BOOK_COVER_TEMPLATES, coverCss, coverIssueLine, coverMarkup, resolveCover } from "../lib/bookCover";
import { bookInputFromBook } from "../lib/bookPublishing";
import { useBooks } from "../store/books";
import { notify } from "../store/toast";

const COVER_CSS = coverCss();
const TEMPLATE_SWATCHES: Record<BookCoverTemplate, CSSProperties> = {
  masthead: { background: "linear-gradient(135deg, #7c2f24, #b04a31)" },
  "photo-led": { background: "linear-gradient(135deg, #29231e, #6f7f6d)" },
  "type-led": { background: "linear-gradient(135deg, #a56b3e, #e0b483)" },
  minimal: { background: "linear-gradient(135deg, #fffaf3, #eadbc8)" },
};

export function CoverArtwork({ book, layout, className = "" }: { book: Book; layout: BookLayout; className?: string }) {
  return <div className={`books-cover-art-frame ${className}`}><style>{COVER_CSS}</style><div dangerouslySetInnerHTML={{ __html: coverMarkup(book, layout) }} /></div>;
}

export function CoverScreen({ book, chapters, onOpenChapter }: { book: Book; chapters: Chapter[]; onOpenChapter: (id: number) => void }) {
  const updateBook = useBooks((state) => state.updateBook);
  const [layout, setLayout] = useState<BookLayout>(() => layoutForBook(book));
  const [coverColor, setCoverColor] = useState(book.cover_color || "#a56b3e");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const layoutRef = useRef(layout);
  const colorRef = useRef(coverColor);
  const bookRef = useRef(book);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  bookRef.current = book;

  useEffect(() => {
    const next = layoutForBook(book);
    const nextColor = book.cover_color || "#a56b3e";
    layoutRef.current = next;
    colorRef.current = nextColor;
    dirtyRef.current = false;
    setLayout(next);
    setCoverColor(nextColor);
    setSaveState("saved");
  }, [book.id]);

  const saveNow = (nextLayout = layoutRef.current) => {
    const currentBook = bookRef.current;
    return updateBook(currentBook.id, bookInputFromBook({ ...currentBook, cover_color: colorRef.current }, serializeBookLayout(nextLayout)));
  };

  const persist = (next: BookLayout) => {
    layoutRef.current = next;
    setLayout(next);
    dirtyRef.current = true;
    setSaveState("dirty");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setSaveState("saving");
      void saveNow(next).then(() => {
        if (layoutRef.current === next) {
          dirtyRef.current = false;
          setSaveState("saved");
        }
      }).catch((error) => {
        setSaveState("dirty");
        notify("error", "Cover design could not be saved", String(error));
      });
    }, 550);
  };

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (dirtyRef.current && bookRef.current.id === book.id) {
      void saveNow(layoutRef.current).catch((error) => notify("error", "Cover design could not be saved", String(error)));
    }
  }, [book.id]);

  const setCover = (patch: Partial<BookLayout["cover"]>) => persist({ ...layoutRef.current, cover: { ...layoutRef.current.cover, ...patch } });
  const setCoverLine = (index: number, patch: Partial<BookCoverLine>) => {
    const coverLines = layoutRef.current.cover.coverLines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line);
    setCover({ coverLines });
  };
  const addCoverLine = () => {
    if (layoutRef.current.cover.coverLines.length >= 12) return;
    setCover({ coverLines: [...layoutRef.current.cover.coverLines, { label: "", text: "" }] });
  };
  const removeCoverLine = (index: number) => setCover({ coverLines: layoutRef.current.cover.coverLines.filter((_line, lineIndex) => lineIndex !== index) });
  const changeCoverColor = (value: string) => {
    colorRef.current = value;
    setCoverColor(value);
    persist(layoutRef.current);
  };
  const uploadCoverImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("error", "Cover image must be an image", "Choose a PNG, JPEG, WebP, GIF, or SVG file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      notify("error", "Cover image is too large", "Choose an image smaller than 12 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCover({ image: typeof reader.result === "string" ? reader.result : "" });
    reader.onerror = () => notify("error", "Cover image could not be read", String(reader.error ?? "Unknown file error"));
    reader.readAsDataURL(file);
  };
  const printCover = () => {
    document.body.classList.add("print-cover-only");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-cover-only"), 1200);
  };

  const cover = layout.cover;
  const resolved = resolveCover({ ...book, cover_color: coverColor }, layout);
  const coverChapter = chapters.find((chapter) => chapter.chapter_kind === "cover") ?? null;
  const featureChapter = chapters.find((chapter) => chapter.id !== coverChapter?.id && chapter.title.trim() && ["feature", "interview", "profile", "photo_essay", "department", "column", "editorial"].includes(chapter.chapter_kind)) ?? null;
  const coverLines = cover.coverLines;
  return (
    <div className="books-screen books-cover-screen">
      <div className="books-screen-heading">
        <div>
          <span className="books-eyebrow"><Camera size={13} /> Cover studio</span>
          <h1>Design the front cover.</h1>
          <p>Shape the masthead, issue language, cover lines, and artwork into a cover that carries the whole issue.</p>
        </div>
        <div className="books-cover-heading-actions">
          <span className={`books-save-state ${saveState}`} aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Saved locally"}</span>
          <button className="books-primary-action" onClick={printCover}><Printer size={15} /> Print cover</button>
        </div>
      </div>

      {coverChapter && <button className="books-cover-source" onClick={() => onOpenChapter(coverChapter.id)}><span><FileText size={14} /> Cover section copy</span><small>Edit “{coverChapter.title || "Cover"}” for the reader-facing cover text</small><span className="books-cover-source-link">Open section</span></button>}

      <div className="books-cover-layout">
        <div className="books-cover-controls">
          <section className="books-settings-card">
            <div className="books-card-heading"><LayoutTemplate size={16} /><div><h2>Cover template</h2><p>Choose the composition that fits this issue.</p></div></div>
            <div className="books-cover-template-grid">
              {BOOK_COVER_TEMPLATES.map((template) => <button key={template.id} type="button" className={`books-cover-template ${cover.template === template.id ? "active" : ""}`} onClick={() => setCover({ template: template.id })} aria-pressed={cover.template === template.id}>
                <span className="books-cover-template-swatch" style={TEMPLATE_SWATCHES[template.id]} aria-hidden="true"><i /><i /><i /></span>
                <span><strong>{template.label}</strong><small>{template.description}</small></span>
              </button>)}
            </div>
            <label className="books-toggle-row books-cover-include"><span><strong>Include designed cover in print &amp; export</strong><small>Adds a full-bleed cover page before the title page.</small></span><input type="checkbox" checked={cover.enabled} onChange={(event) => setCover({ enabled: event.target.checked })} /></label>
          </section>

          <section className="books-settings-card">
            <div className="books-card-heading"><Type size={16} /><div><h2>Cover words</h2><p>Leave a field blank to inherit the book metadata.</p></div></div>
            <div className="books-form-grid">
              <label className="books-form-full">Masthead<input value={cover.masthead} onChange={(event) => setCover({ masthead: event.target.value })} placeholder={book.title || "Untitled"} /></label>
              <label>Kicker<input value={cover.kicker} onChange={(event) => setCover({ kicker: event.target.value })} placeholder={book.genre || "Editorial"} /></label>
              <label>Issue line<input value={cover.issueLine} onChange={(event) => setCover({ issueLine: event.target.value })} placeholder={coverIssueLine(layout.publication) || "Issue 01 · Spring"} /></label>
              <label className="books-form-full">Headline<input value={cover.headline} onChange={(event) => setCover({ headline: event.target.value })} placeholder={book.subtitle || "A cover headline"} /></label>
              {(coverChapter?.title || featureChapter?.title) && <div className="books-cover-suggestions books-form-full">
                <span>Pull a headline</span>
                {coverChapter?.title && <button type="button" onClick={() => setCover({ headline: coverChapter.title })}>Issue: {coverChapter.title}</button>}
                {featureChapter?.title && <button type="button" onClick={() => setCover({ headline: featureChapter.title })}>Feature: {featureChapter.title}</button>}
              </div>}
              <label className="books-form-full">Standfirst<textarea value={cover.standfirst} onChange={(event) => setCover({ standfirst: event.target.value })} placeholder={book.description || "A short line that invites the reader inside."} /></label>
            </div>
            <label className="books-toggle-row books-cover-inline-toggle"><span><strong>Show issue line</strong><small>Display the volume, issue, season, and year lockup.</small></span><input type="checkbox" checked={cover.showIssueLine} onChange={(event) => setCover({ showIssueLine: event.target.checked })} /></label>
          </section>

          <section className="books-settings-card">
            <div className="books-card-heading"><Sparkles size={16} /><div><h2>Cover lines</h2><p>Short sell lines that sit across the foot of the cover.</p></div></div>
            <div className="books-cover-line-list">
              {coverLines.length === 0 && <p className="books-cover-empty">Add a cover line for a feature, department, or contributor.</p>}
              {coverLines.map((line, index) => <div className="books-cover-line-row" key={index}>
                <input value={line.label} onChange={(event) => setCoverLine(index, { label: event.target.value })} placeholder="Kicker" aria-label={`Cover line ${index + 1} kicker`} />
                <input value={line.text} onChange={(event) => setCoverLine(index, { text: event.target.value })} placeholder="A line for the cover" aria-label={`Cover line ${index + 1} text`} />
                <button type="button" onClick={() => removeCoverLine(index)} aria-label={`Remove cover line ${index + 1}`} title="Remove cover line"><Trash2 size={13} /></button>
              </div>)}
            </div>
            <button type="button" className="books-outline-secondary books-cover-add-line" onClick={addCoverLine} disabled={coverLines.length >= 12}><Sparkles size={13} /> Add cover line</button>
          </section>

          <section className="books-settings-card">
            <div className="books-card-heading"><Palette size={16} /><div><h2>Artwork &amp; colour</h2><p>Set the cover stock, image, and ink.</p></div></div>
            <div className="books-form-grid">
              <label>Cover colour<div className="books-color-field"><input className="books-color-input" type="color" value={coverColor} onChange={(event) => changeCoverColor(event.target.value)} /><code>{coverColor}</code></div></label>
              <label>Text ink<div className="books-color-field"><input className="books-color-input" type="color" value={cover.textColor || resolved.textColor} onChange={(event) => setCover({ textColor: event.target.value })} /><button type="button" className="books-cover-auto" onClick={() => setCover({ textColor: "" })}>Auto</button></div></label>
              <label>Accent ink<div className="books-color-field"><input className="books-color-input" type="color" value={cover.accentColor || resolved.accentColor} onChange={(event) => setCover({ accentColor: event.target.value })} /><button type="button" className="books-cover-auto" onClick={() => setCover({ accentColor: "" })}>Auto</button></div></label>
              <label>Alignment<select value={cover.alignment} onChange={(event) => setCover({ alignment: event.target.value === "center" ? "center" : "left" })}><option value="left">Left</option><option value="center">Center</option></select></label>
            </div>
            <div className="books-cover-image-actions">
              <label className="books-cover-upload"><ImagePlus size={14} /><span>{cover.image ? "Replace image" : "Add cover image"}</span><input type="file" accept="image/*" onChange={(event) => { uploadCoverImage(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label>
              {cover.image && <button type="button" className="books-cover-remove-image" onClick={() => setCover({ image: "" })}><Trash2 size={13} /> Remove</button>}
              <label>Image fit<select value={cover.imageFit} onChange={(event) => setCover({ imageFit: event.target.value === "contain" ? "contain" : "cover" })}><option value="cover">Fill</option><option value="contain">Fit</option></select></label>
            </div>
            <label className="books-toggle-row books-cover-inline-toggle"><span><strong>Vignette</strong><small>Darken the edges of a cover image for legible type.</small></span><input type="checkbox" checked={cover.vignette} onChange={(event) => setCover({ vignette: event.target.checked })} /></label>
            <p className="books-toc-help">The cover colour also tints the book card in your shelf.</p>
          </section>

          <section className="books-settings-card">
            <div className="books-card-heading"><Camera size={16} /><div><h2>Newsstand details</h2><p>Price and barcode complete the cover lockup.</p></div></div>
            <div className="books-form-grid">
              <label>Price<input value={cover.price} onChange={(event) => setCover({ price: event.target.value })} placeholder="$12" /></label>
              <label className="books-toggle-row"><span><strong>Barcode</strong><small>Show a barcode block.</small></span><input type="checkbox" checked={cover.showBarcode} onChange={(event) => setCover({ showBarcode: event.target.checked })} /></label>
            </div>
            <p className="books-toc-help">Issue metadata lives in <strong>Book settings</strong>. The cover inherits volume, issue, season, and year unless you type an issue line here.</p>
          </section>
        </div>

        <aside className="books-cover-preview">
          <div className="books-cover-preview-head"><div><span>Front cover</span><strong>{book.trim_size.replace("x", " × ")} in</strong></div><span className={`books-cover-export-chip ${cover.enabled ? "on" : ""}`}>{cover.enabled ? "In print & export" : "Preview only"}</span></div>
          <div className="books-cover-preview-stage"><CoverArtwork book={{ ...book, cover_color: coverColor }} layout={layout} className="books-cover-preview-art" /></div>
          <div className="books-cover-preview-actions">
            <button type="button" className="books-primary-action" onClick={printCover}><Printer size={14} /> Print cover</button>
            {coverChapter && <button type="button" className="books-outline-secondary" onClick={() => onOpenChapter(coverChapter.id)}><Upload size={13} /> Cover section</button>}
          </div>
          <p className="books-cover-preview-note">{cover.enabled ? "This cover will appear before the title page in print, HTML, and EPUB exports." : "Turn on “Include designed cover” to add this cover to print and export."}</p>
        </aside>
      </div>
    </div>
  );
}
