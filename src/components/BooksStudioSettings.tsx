import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BookOpen, Check, FileText, LayoutList, NotebookPen, Settings2, Sparkles } from "lucide-react";
import type { Book, BookInput, Chapter } from "../lib/types";
import { layoutForBook, layoutSectionKey, pageRuleFor, serializeBookLayout, type BookLayout, type BookPageNumberStyle, type BookTextRole } from "../lib/bookLayout";
import { orderBookChapters } from "../lib/bookToc";
import { chapterKindLabel, chapterPageBand, FONT_OPTIONS, PAGE_NUMBER_STYLE_OPTIONS, PAGE_START_OPTIONS, STATUS_OPTIONS, TRIM_SIZES, type PageBand } from "../lib/bookPublishing";
import { useBooks } from "../store/books";
import { notify } from "../store/toast";
import type { MatterFocus } from "./BooksStudio";

export function SettingsScreen({ book, chapters, focus }: { book: Book; chapters: Chapter[]; focus?: MatterFocus }) {
  const updateBook = useBooks((state) => state.updateBook);
  const orderedChapters = orderBookChapters(chapters);
  const frontMatterRef = useRef<HTMLElement>(null);
  const backMatterRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<BookInput>({
    title: book.title, subtitle: book.subtitle, author: book.author, description: book.description, genre: book.genre, status: book.status,
    trimSize: book.trim_size, fontFamily: book.font_family, fontSize: book.font_size, lineHeight: book.line_height, paragraphSpacing: book.paragraph_spacing, margin: book.margin,
    wordGoal: book.word_goal, coverColor: book.cover_color, dedication: book.dedication, epigraph: book.epigraph, copyrightText: book.copyright_text, acknowledgements: book.acknowledgements,
    tocEnabled: book.toc_enabled, tocTitle: book.toc_title, tocDepth: book.toc_depth, tocIncludeFrontMatter: book.toc_include_front_matter, tocIncludeBackMatter: book.toc_include_back_matter,
    layoutJson: book.layout_json,
  });
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  const savedRef = useRef(true);
  const savingRef = useRef(false);
  const draftVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const closingRef = useRef(false);
  useEffect(() => {
    const nextDraft = { title: book.title, subtitle: book.subtitle, author: book.author, description: book.description, genre: book.genre, status: book.status, trimSize: book.trim_size, fontFamily: book.font_family, fontSize: book.font_size, lineHeight: book.line_height, paragraphSpacing: book.paragraph_spacing, margin: book.margin, wordGoal: book.word_goal, coverColor: book.cover_color, dedication: book.dedication, epigraph: book.epigraph, copyrightText: book.copyright_text, acknowledgements: book.acknowledgements, tocEnabled: book.toc_enabled, tocTitle: book.toc_title, tocDepth: book.toc_depth, tocIncludeFrontMatter: book.toc_include_front_matter, tocIncludeBackMatter: book.toc_include_back_matter, layoutJson: book.layout_json };
    draftRef.current = nextDraft;
    savedRef.current = true;
    savingRef.current = false;
    draftVersionRef.current = 0;
    savedVersionRef.current = 0;
    setDraft(nextDraft);
    setSaved(true);
    setSaving(false);
  }, [book.id]);
  useEffect(() => () => {
    if (draftVersionRef.current <= savedVersionRef.current) return;
    void updateBook(book.id, draftRef.current).catch((error) => notify("error", "Book settings could not be saved", String(error)));
  }, [book.id, updateBook]);
  useEffect(() => {
    const section = focus === "front" ? frontMatterRef.current : focus === "back" ? backMatterRef.current : null;
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [book.id, focus]);
  const set = <K extends keyof BookInput>(key: K, value: BookInput[K]) => {
    setDraft((current) => {
      let next = { ...current, [key]: value } as BookInput;
      if (key === "fontFamily" || key === "fontSize" || key === "lineHeight") {
        const resolved = layoutForBook({ ...book, font_family: String(next.fontFamily), font_size: Number(next.fontSize), line_height: Number(next.lineHeight), layout_json: next.layoutJson ?? book.layout_json });
        const typography = { ...resolved.typography };
        (Object.keys(typography) as BookTextRole[]).forEach((role) => {
          const style = typography[role];
          typography[role] = {
            ...style,
            ...(key === "fontFamily" ? { fontFamily: String(next.fontFamily) } : {}),
            ...(key === "fontSize" && (role === "paragraph" || role === "quote") ? { fontSize: Number(next.fontSize) } : {}),
            ...(key === "lineHeight" && (role === "paragraph" || role === "quote") ? { lineHeight: Number(next.lineHeight) } : {}),
          };
        });
        next = { ...next, layoutJson: serializeBookLayout({ ...resolved, typography }) };
      }
      draftRef.current = next;
      draftVersionRef.current += 1;
      return next;
    });
    savedRef.current = false;
    setSaved(false);
  };
  const layout = layoutForBook({ ...book, font_family: draft.fontFamily, font_size: draft.fontSize, line_height: draft.lineHeight, layout_json: draft.layoutJson ?? book.layout_json });
  const setLayout = (next: BookLayout) => set("layoutJson", serializeBookLayout(next));
  const setChrome = (kind: "header" | "footer", side: "left" | "center" | "right", value: string) => setLayout({ ...layout, [kind]: { ...layout[kind], [side]: value } });
  const setNumbering = (next: Partial<BookLayout["pageNumbering"]>) => setLayout({ ...layout, pageNumbering: { ...layout.pageNumbering, ...next } });
  const setSectionRule = (key: string, next: Partial<ReturnType<typeof pageRuleFor>>) => setNumbering({ rules: { ...layout.pageNumbering.rules, [key]: { ...pageRuleFor(layout, key), ...next } } });
  const toggleSectionOverride = (key: string) => {
    const rules = { ...layout.pageNumbering.rules };
    if (rules[key]) {
      delete rules[key];
    } else {
      rules[key] = { ...pageRuleFor(layout, key), enabled: true };
    }
    setNumbering({ rules });
  };
  const numberingRule = (key: string, title: string, detail: string, band: PageBand) => {
    const override = Boolean(layout.pageNumbering.rules[key]);
    const rule = pageRuleFor(layout, key);
    return (
      <div className="books-numbering-rule" key={key}>
        <div className="books-numbering-rule-title"><strong>{title}</strong><small>{detail} · {band}</small></div>
        <label className="books-rule-toggle"><span>Override</span><input type="checkbox" checked={override} onChange={() => toggleSectionOverride(key)} /></label>
        {override && <>
          <label className="books-rule-toggle"><span>Show</span><input type="checkbox" checked={rule.enabled} onChange={(event) => setSectionRule(key, { enabled: event.target.checked })} /></label>
          <div className="books-rule-controls">
            <label>Style<select value={rule.style} onChange={(event) => setSectionRule(key, { style: event.target.value as BookPageNumberStyle })}>{PAGE_NUMBER_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Starts at<input type="number" min="1" max="9999" value={rule.start} onChange={(event) => setSectionRule(key, { start: Math.max(1, Number(event.target.value) || 1) })} /></label>
            {rule.style === "custom" && <label>Format<input value={rule.customFormat} onChange={(event) => setSectionRule(key, { customFormat: event.target.value })} placeholder="Part {n}" /></label>}
          </div>
        </>}
      </div>
    );
  };
  const persist = useCallback(async (announce = false) => {
    if (savingRef.current) return;
    const version = draftVersionRef.current;
    const snapshot = draftRef.current;
    savingRef.current = true;
    setSaving(true);
    try {
      await updateBook(book.id, snapshot);
      savedVersionRef.current = Math.max(savedVersionRef.current, version);
      if (draftVersionRef.current === version) {
        savedRef.current = true;
        setSaved(true);
      }
      if (announce) notify("success", "Book settings saved");
    } catch (error) {
      savedRef.current = false;
      notify("error", "Book settings could not be saved", String(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [book.id, updateBook]);
  useEffect(() => {
    if (saved || saving) return;
    const timer = window.setTimeout(() => void persist(false), 900);
    return () => window.clearTimeout(timer);
  }, [draft, persist, saved, saving]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void getCurrentWindow().onCloseRequested(async (event) => {
      if (closingRef.current || draftVersionRef.current <= savedVersionRef.current) return;
      event.preventDefault();
      closingRef.current = true;
      try {
        await updateBook(book.id, draftRef.current);
        savedVersionRef.current = draftVersionRef.current;
        await getCurrentWindow().destroy();
      } catch (error) {
        closingRef.current = false;
        notify("error", "Close paused: settings were not saved", String(error));
      }
    }).then((dispose) => {
      if (cancelled) dispose();
      else unlisten = dispose;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [book.id, updateBook]);
  return (
    <div className="books-screen books-settings-screen">
       <div className="books-screen-heading"><div><span className="books-eyebrow"><Settings2 size={13} /> Editorial controls</span><h1>Book settings</h1><p>Set the identity and page language of this manuscript. Changes save automatically.</p></div><button className="books-primary-action" onClick={() => void persist(true)} disabled={saved || saving}><Check size={15} /> {saving ? "Saving…" : saved ? "Saved" : "Save now"}</button></div>
      <div className="books-settings-grid">
         <section className="books-settings-card books-settings-wide"><div className="books-card-heading"><BookOpen size={16} /><div><h2>Identity</h2><p>How this work appears to readers and export tools.</p></div></div><div className="books-form-grid"><label>Title<input value={draft.title} onChange={(event) => set("title", event.target.value)} /></label><label>Subtitle<input value={draft.subtitle} onChange={(event) => set("subtitle", event.target.value)} /></label><label>Author<input value={draft.author} onChange={(event) => set("author", event.target.value)} /></label><label>Genre<input value={draft.genre} onChange={(event) => set("genre", event.target.value)} placeholder="Literary fiction" /></label><label>Status<select value={draft.status} onChange={(event) => set("status", event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Word goal<input type="number" min="100" max="1000000" step="500" value={draft.wordGoal ?? 50000} onChange={(event) => set("wordGoal", Math.max(100, Number(event.target.value) || 100))} /></label><label>Cover color<div className="books-color-field"><input className="books-color-input" type="color" value={draft.coverColor ?? "#a56b3e"} onChange={(event) => set("coverColor", event.target.value)} /><code>{draft.coverColor ?? "#a56b3e"}</code></div></label><label className="books-form-full">Description<textarea value={draft.description} onChange={(event) => set("description", event.target.value)} placeholder="A private note about the work…" /></label></div></section>
          <section ref={frontMatterRef} className="books-settings-card books-settings-wide"><div className="books-card-heading"><NotebookPen size={16} /><div><h2>Front matter</h2><p>Optional pages that come before the first chapter.</p></div></div><div className="books-form-grid"><label>Dedication<textarea value={draft.dedication ?? ""} onChange={(event) => set("dedication", event.target.value)} placeholder="For…" /></label><label>Epigraph<textarea value={draft.epigraph ?? ""} onChange={(event) => set("epigraph", event.target.value)} placeholder="A quotation or opening note…" /></label><label className="books-form-full">Copyright<textarea value={draft.copyrightText ?? ""} onChange={(event) => set("copyrightText", event.target.value)} placeholder="Copyright…" /></label></div></section>
           <section ref={backMatterRef} className="books-settings-card books-settings-wide"><div className="books-card-heading"><Sparkles size={16} /><div><h2>Back matter</h2><p>Optional closing pages for the finished book.</p></div></div><label>Acknowledgements<textarea value={draft.acknowledgements ?? ""} onChange={(event) => set("acknowledgements", event.target.value)} placeholder="Thank the people who helped bring this work to life…" /></label></section>
         <section className="books-settings-card books-settings-wide"><div className="books-card-heading"><LayoutList size={16} /><div><h2>Contents</h2><p>Choose which sections and Markdown headings become the reader's map.</p></div></div><label className="books-toggle-row"><span><strong>Generate a contents page</strong><small>Include the generated contents in exported books.</small></span><input type="checkbox" checked={draft.tocEnabled ?? true} onChange={(event) => set("tocEnabled", event.target.checked)} /></label><div className="books-form-grid books-toc-form-grid"><label>Contents title<input value={draft.tocTitle ?? "Contents"} onChange={(event) => set("tocTitle", event.target.value)} placeholder="Contents" /></label><label>Heading depth<select value={draft.tocDepth ?? 3} onChange={(event) => set("tocDepth", Number(event.target.value))}><option value={0}>Sections only</option>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>Through H{level}</option>)}</select></label><label className="books-toggle-row"><span><strong>Opening pages</strong><small>Include legacy dedication, epigraph, and copyright pages.</small></span><input type="checkbox" checked={draft.tocIncludeFrontMatter ?? false} onChange={(event) => set("tocIncludeFrontMatter", event.target.checked)} /></label><label className="books-toggle-row"><span><strong>Closing pages</strong><small>Include legacy acknowledgements.</small></span><input type="checkbox" checked={draft.tocIncludeBackMatter ?? false} onChange={(event) => set("tocIncludeBackMatter", event.target.checked)} /></label></div><p className="books-toc-help">Use the eye controls beside sections and in Outline to include or hide individual entries.</p></section>
         <section className="books-settings-card books-settings-wide books-chrome-settings">
           <div className="books-card-heading"><FileText size={16} /><div><h2>Headers &amp; footers</h2><p>Give every page a quiet publishing signature. Leave a field blank to omit it.</p></div></div>
           <div className="books-chrome-grid">
             {(["header", "footer"] as const).map((kind) => (
               <div className="books-chrome-block" key={kind}>
                 <div className="books-chrome-block-heading"><strong>{kind === "header" ? "Running header" : "Running footer"}</strong><small>Three aligned slots</small></div>
                 <div className="books-chrome-fields">
                   {(["left", "center", "right"] as const).map((side) => <label key={side}>{side}<input value={layout[kind][side]} onChange={(event) => setChrome(kind, side, event.target.value)} placeholder={side === "center" ? "Optional" : ""} /></label>)}
                 </div>
               </div>
             ))}
           </div>
           <p className="books-toc-help">Tokens: <code>{"{{title}}"}</code> title, <code>{"{{author}}"}</code> author, <code>{"{{section}}"}</code> section name, and <code>{"{{page}}"}</code> page number.</p>
         </section>
         <section className="books-settings-card books-settings-wide books-numbering-settings">
           <div className="books-card-heading"><NotebookPen size={16} /><div><h2>Page numbering</h2><p>Set the default sequence, then override any manuscript section when its numbering needs to change.</p></div></div>
           <div className="books-form-grid books-page-numbering-grid">
             <label className="books-toggle-row"><span><strong>Show page numbers</strong><small>Include the resolved number in the selected footer slot.</small></span><input type="checkbox" checked={layout.pageNumbering.enabled} onChange={(event) => setNumbering({ enabled: event.target.checked })} /></label>
             <label>Default style<select value={layout.pageNumbering.style} onChange={(event) => setNumbering({ style: event.target.value as BookPageNumberStyle })}>{PAGE_NUMBER_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
             <label>Number placement<select value={layout.pageNumbering.placement} onChange={(event) => setNumbering({ placement: event.target.value as BookLayout["pageNumbering"]["placement"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
             <label>First number<input type="number" min="1" max="9999" value={layout.pageNumbering.start} onChange={(event) => setNumbering({ start: Math.max(1, Number(event.target.value) || 1) })} /></label>
             <label>Numbering begins<select value={layout.pageNumbering.startSection} onChange={(event) => setNumbering({ startSection: event.target.value as BookLayout["pageNumbering"]["startSection"] })}>{PAGE_START_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
             {layout.pageNumbering.style === "custom" && <label>Custom format<input value={layout.pageNumbering.customFormat} onChange={(event) => setNumbering({ customFormat: event.target.value })} placeholder="Page {n}" /></label>}
           </div>
            <div className="books-section-numbering">
              <div className="books-subheading"><strong>Section overrides</strong><small>Turn on an override to start a new range or switch styles for that section.</small></div>
              {numberingRule(layoutSectionKey("opening"), "Opening pages", "Dedication, epigraph, and copyright", "opening")}
              {numberingRule(layoutSectionKey("contents"), "Contents page", "Generated contents", "contents")}
              {orderedChapters.map((chapter) => numberingRule(layoutSectionKey(chapterPageBand(chapter), chapter.id), chapter.title || "Untitled section", chapterKindLabel(chapter.chapter_kind), chapterPageBand(chapter)))}
              {numberingRule(layoutSectionKey("closing"), "Closing pages", "Acknowledgements and other back matter", "closing")}
            </div>
         </section>
         <section className="books-settings-card"><div className="books-card-heading"><FileText size={16} /><div><h2>Page design</h2><p>Trim and spacing for your soft copy.</p></div></div><label>Trim size<select value={draft.trimSize} onChange={(event) => set("trimSize", event.target.value)}>{TRIM_SIZES.map((option) => <option key={option.value} value={option.value}>{option.label} - {option.description}</option>)}</select></label><label>Typeface<select value={draft.fontFamily} onChange={(event) => set("fontFamily", event.target.value)}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="books-range-row"><label>Font size<strong>{draft.fontSize} pt</strong><input type="range" min="9" max="18" step="0.5" value={draft.fontSize} onChange={(event) => set("fontSize", Number(event.target.value))} /></label><label>Line height<strong>{draft.lineHeight.toFixed(2)}</strong><input type="range" min="1.2" max="2" step="0.05" value={draft.lineHeight} onChange={(event) => set("lineHeight", Number(event.target.value))} /></label></div><div className="books-range-row"><label>Paragraph gap<strong>{draft.paragraphSpacing} em</strong><input type="range" min="0" max="1.5" step="0.1" value={draft.paragraphSpacing} onChange={(event) => set("paragraphSpacing", Number(event.target.value))} /></label><label>Margins<strong>{draft.margin} in</strong><input type="range" min="0.5" max="1.5" step="0.05" value={draft.margin} onChange={(event) => set("margin", Number(event.target.value))} /></label></div></section>
      </div>
    </div>
  );
}
