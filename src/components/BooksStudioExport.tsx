import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Info,
  NotebookPen,
  Printer,
} from "lucide-react";
import type { Book, Chapter } from "../lib/types";
import { bookExportChecks } from "../lib/bookExport";
import { layoutForBook, layoutForChapter, layoutSectionKey, serializeBookLayout } from "../lib/bookLayout";
import { backMatterSections, buildBookToc, frontMatterSections, matterAnchorId, orderBookChapters, sectionAnchorId, type TocEntry } from "../lib/bookToc";
import { chapterBandOrdinal, chapterDisplayLabel, chapterHasDistinctTitle, chapterIsOpeningPage, chapterPageBand, chapterTitleHeading, EXPORT_OPTIONS, markdownToHtml, paragraphStylesCss, tocTitle, trimCssSize, TRIM_SIZES, wordCount } from "../lib/bookPublishing";
import { notify } from "../store/toast";
import {
  BooksPageChrome,
  exportBook,
  handleTabListKeyDown,
  manuscriptStyle,
} from "./BooksStudio";
import { CoverArtwork } from "./BooksCoverStudio";
import type { ExportFormat, StudioScreen } from "./BooksStudio";

export function ContentsPreview({ book, entries }: { book: Book; entries: TocEntry[] }) {
  return (
    <div className="books-preview-contents">
      <div className="books-preview-contents-heading"><span>{tocTitle(book)}</span><small>{entries.length} entries</small></div>
      {entries.length === 0 ? (
        <p className="books-preview-contents-empty">Enable contents or add headings to see the reader's map.</p>
      ) : (
        <div className="books-preview-contents-list">
          {entries.slice(0, 10).map((entry) => <div key={entry.id} style={{ paddingLeft: `${Math.max(0, entry.level - 1) * 11}px` }} className={entry.source === "heading" ? "heading" : "section"}>{entry.label}</div>)}
          {entries.length > 10 && <div className="books-preview-contents-more">+ {entries.length - 10} more entries</div>}
        </div>
      )}
    </div>
  );
}

export function InteriorPreview({ book, chapters, chapterId }: { book: Book; chapters: Chapter[]; chapterId: number | null }) {
  const orderedChapters = orderBookChapters(chapters);
  const chapter = orderedChapters.find((item) => item.id === chapterId && !chapterIsOpeningPage(item.chapter_kind)) ?? orderedChapters.find((item) => !chapterIsOpeningPage(item.chapter_kind)) ?? null;
  if (!chapter) return <div className="books-preview-empty-state"><BookOpen size={20} /><strong>Add a section to preview the interior.</strong><span>The cover preview will use your book metadata.</span></div>;
  const chapterIndex = orderedChapters.indexOf(chapter);
  const band = chapterPageBand(chapter);
  const layout = layoutForChapter(book, chapter);
  const label = chapterTitleHeading(chapter, chapterIndex, orderedChapters);
  const showKicker = band === "story" && chapterHasDistinctTitle(chapter, chapterIndex, orderedChapters);
  return <div className="books-interior-preview" style={{ ...manuscriptStyle({ ...book, layout_json: serializeBookLayout(layout) }), backgroundColor: layout.pageColor }}><BooksPageChrome book={book} layout={layout} keyName={layoutSectionKey(band, chapter.id)} section={label} band={band} ordinal={chapterBandOrdinal(orderedChapters, chapterIndex)} />{showKicker && <span className="books-preview-kicker">{chapterDisplayLabel(chapter, chapterIndex, orderedChapters)}</span>}<h2 className="book-heading-1">{label}</h2><article dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content, sectionAnchorId(chapter.id), layout.typography, layout.paragraphStyles) }} /></div>;
}

export function ExportScreen({ book, chapters, onNavigate, onOpenChapter }: { book: Book; chapters: Chapter[]; onNavigate: (screen: StudioScreen) => void; onOpenChapter: (id: number) => void }) {
  const [format, setFormat] = useState<ExportFormat>("epub");
  const [previewMode, setPreviewMode] = useState<"cover" | "interior">("cover");
  const [previewChapterId, setPreviewChapterId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = EXPORT_OPTIONS.find((option) => option.value === format)!;
  const layout = layoutForBook(book);
  const totalWords = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  const toc = useMemo(() => buildBookToc(book, chapters), [book, chapters]);
  const preflight = useMemo(() => bookExportChecks(book, chapters), [book, chapters]);
  const attentionCount = preflight.filter((check) => check.severity !== "info").length;
  const interiorChapters = orderBookChapters(chapters).filter((chapter) => !chapterIsOpeningPage(chapter.chapter_kind));
  const coverChapter = orderBookChapters(chapters).find((chapter) => chapter.chapter_kind === "cover") ?? null;
  const coverLayout = coverChapter ? layoutForChapter(book, coverChapter) : layout;
  const selectedPreviewChapterId = interiorChapters.some((chapter) => chapter.id === previewChapterId) ? previewChapterId : (interiorChapters[0]?.id ?? null);
  const handleExport = async () => { setBusy(true); try { await exportBook(book, chapters, format); } catch (error) { notify("error", "Export failed", String(error)); } finally { setBusy(false); } };
  const openPreflightItem = (check: (typeof preflight)[number]) => {
    if (check.chapterId !== undefined) {
      onOpenChapter(check.chapterId);
    } else {
      onNavigate(check.target === "manuscript" ? "manuscript" : check.target);
    }
  };
  return (
    <div className="books-screen books-export-screen">
      <div className="books-screen-heading"><div><span className="books-eyebrow"><Download size={13} /> Soft copy desk</span><h1>Export studio</h1><p>Build a beautiful copy for the reader, editor, or archive.</p></div><button className="books-primary-action" onClick={() => void handleExport()} disabled={busy || chapters.length === 0}><Download size={15} /> {busy ? "Preparing…" : `Export ${selected.label}`}</button></div>
       <div className="books-export-layout">
         <div className="books-export-options">
           <span className="books-eyebrow">Choose a format</span>
           <div className="books-export-format-list" role="radiogroup" aria-label="Export format">
             {EXPORT_OPTIONS.map((option) => <button key={option.value} role="radio" aria-checked={format === option.value} className={`books-export-option ${format === option.value ? "active" : ""}`} onClick={() => setFormat(option.value)}><span className="books-export-option-icon">{option.value === "epub" ? <BookOpen size={17} /> : option.value === "docx" ? <FileText size={17} /> : option.value === "html" ? <FileCode2 size={17} /> : <NotebookPen size={17} />}</span><span><strong>{option.label}</strong><small>{option.description}</small></span>{format === option.value && <Check size={15} />}</button>)}
           </div>
           <button className="books-print-option" onClick={() => window.print()}><Printer size={15} /><span><strong>Print / Save as PDF</strong><small>Uses your trim size and page styling</small></span></button>
           <section className={`books-export-preflight ${attentionCount ? "needs-attention" : "ready"}`} aria-labelledby="books-export-preflight-heading">
             <div className="books-export-preflight-heading"><div><span className="books-eyebrow">Package check</span><h2 id="books-export-preflight-heading">{attentionCount ? `${attentionCount} ${attentionCount === 1 ? "item" : "items"} need attention` : preflight.length ? `${preflight.length} finishing ${preflight.length === 1 ? "suggestion" : "suggestions"}` : "Ready for readers"}</h2></div><span className="books-export-preflight-count">{preflight.length || <Check size={14} />}</span></div>
             {preflight.length ? <div className="books-export-preflight-list">{preflight.map((check) => <button key={check.id} onClick={() => openPreflightItem(check)}><span className={`books-export-preflight-icon ${check.severity}`}>{check.severity === "info" ? <Info size={14} /> : <AlertTriangle size={14} />}</span><span><strong>{check.label}</strong><small>{check.detail}</small></span><ChevronRight size={13} /></button>)}</div> : <p>Core metadata, sections, and reader navigation look complete.</p>}
             <div className="books-export-signals"><span className={book.toc_enabled ? "ready" : "muted"}>{book.toc_enabled ? "Contents included" : "Contents off"}</span><span>{layoutForBook(book).pageNumbering.enabled ? "Page numbers on" : "Page numbers off"}</span><span>{chapters.some((chapter) => chapter.content.includes("data:image/")) ? "Artwork embedded" : "No artwork"}</span></div>
           </section>
         </div>
         <div className="books-export-preview">
            <div className="books-preview-toolbar"><span>Output preview</span><div className="books-preview-toolbar-actions"><div className="books-preview-mode" role="tablist" aria-label="Preview page" onKeyDown={handleTabListKeyDown}><button className={previewMode === "cover" ? "active" : ""} onClick={() => setPreviewMode("cover")} role="tab" aria-selected={previewMode === "cover"} tabIndex={previewMode === "cover" ? 0 : -1}>Cover</button><button className={previewMode === "interior" ? "active" : ""} onClick={() => setPreviewMode("interior")} role="tab" aria-selected={previewMode === "interior"} tabIndex={previewMode === "interior" ? 0 : -1}>Interior</button></div>{previewMode === "interior" && interiorChapters.length > 0 && <label className="books-preview-section-picker"><span>Section</span><select aria-label="Preview section" value={selectedPreviewChapterId ?? ""} onChange={(event) => setPreviewChapterId(Number(event.target.value))}>{interiorChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title || chapterDisplayLabel(chapter, interiorChapters.indexOf(chapter), interiorChapters)}</option>)}</select></label>}<span>{TRIM_SIZES.find((size) => size.value === book.trim_size)?.label ?? book.trim_size} / {totalWords.toLocaleString()} words</span></div></div>
            {previewMode === "cover" ? (layout.cover.enabled ? <div className="books-preview-cover-art"><CoverArtwork book={book} layout={layout} /></div> : coverChapter ? <div className="books-preview-page books-preview-cover-chapter" style={{ ...manuscriptStyle({ ...book, layout_json: serializeBookLayout(coverLayout) }), backgroundColor: coverLayout.pageColor }}><BooksPageChrome book={book} layout={coverLayout} keyName="opening" section={coverChapter.title || "Cover"} band="opening" ordinal={0} /><span className="books-preview-kicker">{book.genre || "Magazine"}</span><h2 className="book-title">{coverChapter.title || book.title || "Untitled magazine"}</h2><article dangerouslySetInnerHTML={{ __html: markdownToHtml(coverChapter.content, sectionAnchorId(coverChapter.id), coverLayout.typography, coverLayout.paragraphStyles) }} /></div> : <div className="books-preview-page" style={manuscriptStyle(book)}><BooksPageChrome book={book} layout={layout} keyName="story" section="Chapter 1" band="story" ordinal={0} /><span className="books-preview-kicker">{book.genre || "Manuscript"}</span><h2 className="book-title">{book.title || "Untitled manuscript"}</h2>{book.subtitle && <p className="books-preview-subtitle">{book.subtitle}</p>}<span className="books-preview-author">{book.author || "Author"}</span><div className="books-preview-rule" /><p>{book.description || "Your book description will appear in the front matter and metadata of exported copies."}</p><ContentsPreview book={book} entries={toc} /></div>) : <InteriorPreview book={book} chapters={chapters} chapterId={selectedPreviewChapterId} />}
         </div>
       </div>
    </div>
  );
}

export function PrintBook({ book, chapters, toc }: { book: Book; chapters: Chapter[]; toc: TocEntry[] }) {
  const layout = layoutForBook(book);
  const orderedChapters = orderBookChapters(chapters);
  const chapterLayouts = new Map(orderedChapters.map((chapter) => [chapter.id, layoutForChapter(book, chapter)]));
  const titlePage = orderedChapters.find((chapter) => chapterIsOpeningPage(chapter.chapter_kind));
  const titleLayout = titlePage ? chapterLayouts.get(titlePage.id) ?? layout : layout;
  const front = frontMatterSections(book, chapters);
  const contentChapters = orderedChapters.filter((chapter) => !chapterIsOpeningPage(chapter.chapter_kind));
  const back = backMatterSections(book, chapters);
  const namedPageCss = orderedChapters.map((chapter) => {
    const page = chapterLayouts.get(chapter.id) ?? layout;
    const name = `book-page-${chapter.id}`;
    return `@page ${name}{size:${trimCssSize(book.trim_size)};margin:${page.pageMargins.top}in ${page.pageMargins.right}in ${page.pageMargins.bottom}in ${page.pageMargins.left}in;}.${name}{page:${name};}`;
  }).join("");
  const printCss = `@page{size:${trimCssSize(book.trim_size)};margin:${layout.pageMargins.top}in ${layout.pageMargins.right}in ${layout.pageMargins.bottom}in ${layout.pageMargins.left}in;}@page book-cover{size:${trimCssSize(book.trim_size)};margin:0;}.book-print-cover{page:book-cover;}${namedPageCss}${paragraphStylesCss(layout, ".book-print-content")}`;
  const pageStyle = (page: typeof layout, background = page.pageColor) => ({ ...manuscriptStyle({ ...book, layout_json: serializeBookLayout(page) }), backgroundColor: background });
  return (
    <div className="book-print-root" style={manuscriptStyle(book)}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <div className="book-print-content">
        <section className={`book-print-cover ${layout.cover.enabled ? "cover-included" : "cover-disabled"}`}><CoverArtwork book={book} layout={layout} /></section>
        <section className={titlePage ? `book-page-${titlePage.id}` : undefined} style={pageStyle(titleLayout)}>
          <BooksPageChrome book={book} layout={titleLayout} keyName={titlePage ? layoutSectionKey("opening", titlePage.id) : layoutSectionKey("opening")} section={titlePage?.title || "Title page"} band="opening" ordinal={0} />
          <h1 className="book-title">{titlePage?.title || book.title}</h1>
          {!titlePage && book.subtitle && <p className="print-subtitle">{book.subtitle}</p>}
          {!titlePage && book.author && <p className="print-author">{book.author}</p>}
          {titlePage && <div dangerouslySetInnerHTML={{ __html: markdownToHtml(titlePage.content, sectionAnchorId(titlePage.id), titleLayout.typography, titleLayout.paragraphStyles) }} />}
        </section>
        {toc.length > 0 && <section className="print-toc print-page-break" style={pageStyle(layout)}><BooksPageChrome book={book} layout={layout} keyName="contents" section={tocTitle(book)} band="contents" ordinal={0} /><h2 className="book-heading-2">{tocTitle(book)}</h2>{toc.map((entry) => <div key={entry.id} style={{ paddingLeft: `${Math.max(0, entry.level - 1) * 14}pt` }}>{entry.label}</div>)}</section>}
        {front.map((section, index) => <section key={section.title} className="print-matter print-page-break" style={pageStyle(layout)}><BooksPageChrome book={book} layout={layout} keyName="opening" section={section.title} band="opening" ordinal={index} /><h2 className="book-heading-1">{section.title}</h2><div dangerouslySetInnerHTML={{ __html: markdownToHtml(section.content, matterAnchorId(section.key), layout.typography, layout.paragraphStyles) }} /></section>)}
        {contentChapters.map((chapter) => {
          const index = orderedChapters.indexOf(chapter);
          const band = chapterPageBand(chapter);
          const label = chapterTitleHeading(chapter, index, orderedChapters);
          const showKicker = band === "story" && chapterHasDistinctTitle(chapter, index, orderedChapters);
          const chapterLayout = chapterLayouts.get(chapter.id) ?? layout;
          return <section key={chapter.id} id={sectionAnchorId(chapter.id)} className={`${band === "story" ? "" : "print-matter "}print-page-break book-page-${chapter.id}`} style={pageStyle(chapterLayout)}><BooksPageChrome book={book} layout={chapterLayout} keyName={layoutSectionKey(band, chapter.id)} section={label} band={band} ordinal={chapterBandOrdinal(orderedChapters, index)} />{showKicker && <p className="print-chapter-kicker">{chapterDisplayLabel(chapter, index, orderedChapters)}</p>}<h2 className="book-heading-1">{label}</h2><div dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content, sectionAnchorId(chapter.id), chapterLayout.typography, chapterLayout.paragraphStyles) }} /></section>;
        })}
        {back.map((section, index) => <section key={section.title} className="print-matter print-page-break" style={pageStyle(layout)}><BooksPageChrome book={book} layout={layout} keyName="closing" section={section.title} band="closing" ordinal={index} /><h2 className="book-heading-1">{section.title}</h2><div dangerouslySetInnerHTML={{ __html: markdownToHtml(section.content, matterAnchorId(section.key), layout.typography, layout.paragraphStyles) }} /></section>)}
      </div>
    </div>
  );
}
