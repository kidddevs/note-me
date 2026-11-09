import { memo, useId, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  Images,
  Info,
  Layers,
  ListTree,
  LoaderCircle,
  NotebookPen,
  Printer,
} from "lucide-react";
import type { Book, Chapter } from "../lib/types";
import {
  BOOK_OUTPUT_OPTIONS,
  bookExportChecks,
  bookForExport,
  bookPackageSummary,
  groupBookExportChecks,
  saveBookExport,
  type BookExportCheck,
  type BookExportChoices,
  type BookExportReceipt,
  type BookOutputFormat,
} from "../lib/bookExport";
import { layoutForBook, layoutForChapter, layoutSectionKey, serializeBookLayout } from "../lib/bookLayout";
import { coverMetrics, hasCoverDocument, renderCoverCanvas } from "../lib/bookCoverDoc";
import { readBookImageSource } from "../lib/bookImageLibrary";
import { backMatterSections, buildBookToc, frontMatterSections, matterAnchorId, orderBookChapters, sectionAnchorId, type TocEntry } from "../lib/bookToc";
import { chapterBandOrdinal, chapterDisplayLabel, chapterHasDistinctTitle, chapterIsOpeningPage, chapterPageBand, chapterTitleHeading, bookMarkdown, bookText, isDocxImageSource, markdownToHtml, parseImageLine, paragraphStylesCss, tocTitle, trimCssSize, TRIM_SIZES } from "../lib/bookPublishing";
import { notify } from "../store/toast";
import {
  BooksPageChrome,
  handleTabListKeyDown,
  manuscriptStyle,
} from "./BooksStudio";
import { CoverArtwork } from "./BooksCoverStudio";
import type { StudioScreen } from "./BooksStudio";

function ContentsPreview({ book, entries, epub }: { book: Book; entries: TocEntry[]; epub: boolean }) {
  return (
    <div className="books-preview-page books-preview-contents-page" style={manuscriptStyle(book)}>
      <h2 className="book-heading-1">{tocTitle(book)}</h2>
      {entries.length > 0 ? (
        <ol className="books-preview-contents-list">
          {entries.map((entry) => (
            <li key={entry.id} style={{ marginInlineStart: Math.max(0, entry.level - 1) * 11 }}>{entry.label}</li>
          ))}
        </ol>
      ) : (
        <p>{epub ? "Start reading opens the title page in the ebook reader." : "Include sections in Outline to build the contents."}</p>
      )}
    </div>
  );
}

function InteriorPreview({ book, chapters, chapterId, format }: {
  book: Book;
  chapters: Chapter[];
  chapterId: number | null;
  format: BookOutputFormat;
}) {
  const chapterIndex = chapters.findIndex((item) => item.id === chapterId);
  const chapter = chapters[chapterIndex];
  if (!chapter) {
    return <div className="books-preview-empty-state"><BookOpen size={20} /><strong>Add a section to preview the interior.</strong></div>;
  }
  const band = chapterPageBand(chapter);
  const layout = format === "docx" ? layoutForBook(book) : layoutForChapter(book, chapter);
  const label = chapterTitleHeading(chapter, chapterIndex, chapters);
  const showKicker = band === "story" && chapterHasDistinctTitle(chapter, chapterIndex, chapters);
  const content = format === "docx" ? chapter.content.split(/\r?\n/).map((line) => {
    const image = parseImageLine(line);
    if (!image || isDocxImageSource(image.source)) return line;
    return [image.alt || "Artwork", image.presentation.caption, image.presentation.credit].filter(Boolean).join(" — ");
  }).join("\n") : chapter.content;
  return (
    <div className="books-interior-preview" style={manuscriptStyle({ ...book, layout_json: serializeBookLayout(layout) })}>
      <BooksPageChrome book={book} layout={layout} keyName={layoutSectionKey(band, chapter.id)} section={label} band={band} ordinal={chapterBandOrdinal(chapters, chapterIndex)} />
      {showKicker && <span className="books-preview-kicker">{chapterDisplayLabel(chapter, chapterIndex, chapters)}</span>}
      <h2 className="book-heading-1">{label}</h2>
      <article dangerouslySetInnerHTML={{ __html: markdownToHtml(content, sectionAnchorId(chapter.id), layout.typography, layout.paragraphStyles) }} />
    </div>
  );
}

const OUTPUT_ICONS = {
  epub: BookOpen,
  docx: FileText,
  html: FileCode2,
  markdown: NotebookPen,
  txt: FileText,
  print: Printer,
};

type PreviewMode = "cover" | "interior" | "contents";
const PREVIEW_LABELS: Record<PreviewMode, string> = { cover: "Cover", interior: "Interior", contents: "Contents" };
const SOURCE_PREVIEW_LIMIT = 16000;

export function ExportScreen({ book, chapters, onNavigate, onOpenChapter }: {
  book: Book;
  chapters: Chapter[];
  onNavigate: (screen: StudioScreen) => void;
  onOpenChapter: (id: number) => void;
}) {
  const [format, setFormat] = useState<BookOutputFormat>("epub");
  const [choices, setChoices] = useState<BookExportChoices>({});
  const [previewMode, setPreviewMode] = useState<PreviewMode>("cover");
  const [previewChapterId, setPreviewChapterId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<BookExportReceipt | null>(null);
  const [exportError, setExportError] = useState("");
  const [printCover, setPrintCover] = useState<{ book: Book; source: string } | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const formatName = useId();

  const selected = BOOK_OUTPUT_OPTIONS.find((option) => option.value === format)!;
  const sourceLayout = useMemo(() => layoutForBook(book), [book]);
  const edition = useMemo(() => bookForExport(book, format, choices), [book, format, choices]);
  const layout = useMemo(() => layoutForBook(edition), [edition]);
  const summary = useMemo(() => bookPackageSummary(edition, chapters, format), [edition, chapters, format]);
  const toc = useMemo(() => buildBookToc(edition, chapters), [edition, chapters]);
  const preflight = useMemo(() => bookExportChecks(edition, chapters), [edition, chapters]);
  const groups = useMemo(() => groupBookExportChecks(preflight), [preflight]);
  const attentionCount = groups.attention.length;
  const orderedChapters = useMemo(() => orderBookChapters(chapters), [chapters]);
  const selectedChapterId = orderedChapters.find((chapter) => chapter.id === previewChapterId)?.id ?? orderedChapters[0]?.id ?? null;
  const trimLabel = TRIM_SIZES.find((size) => size.value === book.trim_size)?.label ?? book.trim_size;
  const coverAvailable = sourceLayout.cover.enabled || hasCoverDocument(sourceLayout.cover);
  const showCover = Boolean(selected.coverPanel && layout.cover.enabled);
  const modes: PreviewMode[] = [
    ...(showCover ? ["cover" as const] : []),
    "interior",
    ...(toc.length > 0 || format === "epub" ? ["contents" as const] : []),
  ];
  const mode = modes.includes(previewMode) ? previewMode : modes[0];
  const sourcePreview = useMemo(() => {
    if (format === "txt") return bookText(edition, chapters);
    if (format === "markdown") {
      return bookMarkdown(edition, chapters).replace(/(data:image\/[\w+.-]+;base64,)[A-Za-z0-9+/=]+/gi, "$1[embedded image]");
    }
    return null;
  }, [format, edition, chapters]);
  const printEdition = format === "print" ? edition : book;
  const printToc = useMemo(() => buildBookToc(printEdition, chapters), [printEdition, chapters]);
  const blocked = preflight.some((check) => check.severity === "error");
  const ActionIcon = busy ? LoaderCircle : format === "print" ? Printer : Download;

  const handleExport = async () => {
    if (saving.current || blocked) return;
    setExportError("");
    saving.current = true;
    setBusy(true);
    try {
      if (format === "print") {
        if (layout.cover.enabled && hasCoverDocument(layout.cover) && printCover?.book !== book) {
          // A flattened cover keeps its blend effects without rasterizing the interior.
          const metrics = coverMetrics(edition.trim_size, layout.cover);
          const dpi = Math.min(300, Math.floor(Math.sqrt(12_000_000 / (metrics.fullWidth * metrics.fullHeight))));
          const canvas = await renderCoverCanvas(edition, layout.cover, "wrap", { dpi, bleed: true });
          const source = canvas.toDataURL("image/png");
          await readBookImageSource(source);
          if (!screenRef.current) return;
          flushSync(() => setPrintCover({ book, source }));
        }
        await window.print();
        return;
      }
      const saved = await saveBookExport(edition, chapters, format);
      if (saved) setReceipt(saved);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const revealExport = async () => {
    if (!receipt?.path) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(receipt.path);
    } catch (error) {
      notify("error", "Exported file could not be shown", String(error));
    }
  };
  const openPreflightItem = (check: BookExportCheck) => {
    if (check.chapterId !== undefined) onOpenChapter(check.chapterId);
    else onNavigate(check.target);
  };
  const renderCheck = (check: BookExportCheck) => (
    <button key={check.id} type="button" onClick={() => openPreflightItem(check)}>
      <span className={"books-export-preflight-icon " + check.severity}>{check.severity === "info" ? <Info size={14} /> : <AlertTriangle size={14} />}</span>
      <span><strong>{check.label}</strong><small>{check.detail}</small></span>
      <ChevronRight size={13} />
    </button>
  );

  return (
    <>
      <div ref={screenRef} className="books-screen books-export-screen">
        <header className="books-screen-heading">
          <div>
            <span className="books-eyebrow"><Download size={13} /> Publishing desk</span>
            <h1>Export studio</h1>
            <p>{book.title || "Untitled manuscript"} · {trimLabel} · {summary.words.toLocaleString()} words</p>
          </div>
          <button type="button" className="books-primary-action" onClick={() => void handleExport()} disabled={busy || blocked} aria-busy={busy}>
            <ActionIcon size={15} className={busy ? "cover-tool-busy" : undefined} />
            {busy ? (format === "print" ? "Preparing print…" : "Saving export…") : format === "print" ? "Print / Save as PDF" : "Export " + selected.label}
          </button>
        </header>
        {(receipt || exportError) && <div className="books-export-feedback">
          {exportError && <div className="books-export-feedback-row error" role="alert">
            <AlertTriangle size={16} />
            <span><strong>{format === "print" ? "Print could not be prepared" : "Export could not be saved"}</strong><small>{exportError}</small></span>
          </div>}
          {receipt && <div className="books-export-feedback-row">
            <Check size={16} />
            <span role="status"><strong>{receipt.filename}</strong><small>Last export · {(receipt.bytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB</small></span>
            {receipt.path && <button type="button" onClick={() => void revealExport()}><FolderOpen size={15} /> Show file</button>}
          </div>}
        </div>}
        <div className="books-export-layout">
          <div className="books-export-options">
            <fieldset className="books-export-format-list" disabled={busy}>
              <legend className="books-eyebrow">Output format</legend>
              {BOOK_OUTPUT_OPTIONS.map((option) => {
                const Icon = OUTPUT_ICONS[option.value];
                return (
                  <label key={option.value} className={"books-export-option" + (format === option.value ? " active" : "")}>
                    <input type="radio" name={formatName} checked={format === option.value} onChange={() => { setFormat(option.value); setExportError(""); }} />
                    <span className="books-export-option-icon"><Icon size={16} /></span>
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    {format === option.value && <Check size={14} />}
                  </label>
                );
              })}
            </fieldset>
            <fieldset className="books-export-choices" disabled={busy}>
              <legend className="books-eyebrow">Include in this export</legend>
              <div className="books-export-choice-card">
                {selected.coverPanel && (coverAvailable ? (
                  <label>
                    <input type="checkbox" checked={layout.cover.enabled} onChange={(event) => setChoices((current) => ({ ...current, includeCover: event.target.checked }))} />
                    <span><strong>{selected.coverPanel === "wrap" && hasCoverDocument(layout.cover) ? "Full cover spread" : "Front cover"}</strong><small>Use your saved cover artwork</small></span>
                  </label>
                ) : (
                  <button type="button" className="books-export-setting-link" onClick={() => onNavigate("cover")}><Layers size={14} /> Design a cover <ChevronRight size={13} /></button>
                ))}
                <label>
                  <input type="checkbox" checked={edition.toc_enabled} onChange={(event) => setChoices((current) => ({ ...current, includeContents: event.target.checked }))} />
                  <span><strong>Generated contents</strong><small>Use the sections and headings included in Outline</small></span>
                </label>
                {(choices.includeCover !== undefined || choices.includeContents !== undefined) && (
                  <button type="button" className="books-export-setting-link" onClick={() => setChoices({})}>Use manuscript defaults</button>
                )}
              </div>
            </fieldset>
            <section className="books-export-package" aria-labelledby="books-export-package-heading">
              <div className="books-export-package-heading">
                <div><span className="books-eyebrow">Package summary</span><h2 id="books-export-package-heading">{selected.label}</h2></div>
                <span className="books-export-package-extension">{selected.extension}</span>
              </div>
              <div className="books-export-metrics">
                <div><strong>{summary.sections}</strong><span>sections</span></div>
                <div><strong>{summary.words.toLocaleString()}</strong><span>words</span></div>
                <div><strong>{summary.readingMinutes ? summary.readingMinutes + " min" : "—"}</strong><span>estimated read</span></div>
                <div><strong>{summary.readySections} / {summary.sections}</strong><span>marked ready</span></div>
              </div>
              <div className="books-export-includes">
                {showCover && <span className="ready"><Layers size={13} />{summary.cover === "layered" && selected.coverPanel === "wrap" ? "Full cover spread" : "Front cover"}</span>}
                <span className={summary.contentsEntries ? "ready" : "muted"}>
                  <ListTree size={13} />
                  {summary.contentsEntries ? summary.contentsEntries + (summary.contentsEntries === 1 ? " contents entry" : " contents entries") : format === "epub" ? "Reader start link" : "Generated contents omitted"}
                </span>
                {summary.images > 0 && <span className="ready"><Images size={13} />{summary.images} manuscript {summary.images === 1 ? "image" : "images"}{summary.imageCredits ? " · credits included" : ""}</span>}
                {summary.imageReferences > 0 && <span className="ready"><Images size={13} />{summary.imageReferences} image {summary.imageReferences === 1 ? "reference" : "references"}</span>}
                {summary.imageDescriptions > 0 && <span><Info size={13} />{summary.imageDescriptions} {summary.imageDescriptions === 1 ? "image described" : "images described"} in text</span>}
              </div>
              <p className="books-export-format-note">{selected.note}</p>
            </section>
            <section className={"books-export-preflight " + (attentionCount ? "needs-attention" : "ready")} aria-labelledby="books-export-preflight-heading">
              <div className="books-export-preflight-heading">
                <div>
                  <span className="books-eyebrow">Package check</span>
                  <h2 id="books-export-preflight-heading">{attentionCount ? attentionCount + " " + (attentionCount === 1 ? "item needs attention" : "items need attention") : groups.suggestions.length ? "Finishing touches" : "Ready for readers"}</h2>
                </div>
                <span className="books-export-preflight-count">{preflight.length || <Check size={14} />}</span>
              </div>
              {preflight.length > 0 ? <div className="books-export-preflight-list">
                {groups.attention.length > 0 && <div className="books-export-preflight-group"><span>Needs attention</span><small>{groups.attention.length}</small></div>}
                {groups.attention.map(renderCheck)}
                {groups.suggestions.length > 0 && <div className="books-export-preflight-group"><span>Finishing touches</span><small>{groups.suggestions.length}</small></div>}
                {groups.suggestions.map(renderCheck)}
              </div> : <p>Core metadata, sections and reader navigation look complete.</p>}
              <button type="button" className="books-export-plan-link" onClick={() => onNavigate("plan")}>
                <ClipboardList size={14} /><span>{summary.readySections} / {summary.sections} sections marked ready</span><ChevronRight size={13} />
              </button>
            </section>
          </div>
          <section className="books-export-preview" aria-label="Output preview">
            <div className="books-preview-toolbar">
              <span>{sourcePreview === null ? "Output preview" : selected.label + " preview"}</span>
              {sourcePreview === null && <div className="books-preview-mode" role="tablist" aria-label="Preview page" onKeyDown={handleTabListKeyDown}>
                {modes.map((item) => <button type="button" key={item} role="tab" className={mode === item ? "active" : ""} aria-selected={mode === item} tabIndex={mode === item ? 0 : -1} onClick={() => setPreviewMode(item)}>{PREVIEW_LABELS[item]}</button>)}
              </div>}
            </div>
            {sourcePreview !== null ? (
              <div className="books-source-preview">
                <pre>{sourcePreview.slice(0, SOURCE_PREVIEW_LIMIT)}</pre>
                {(format === "markdown" || sourcePreview.length > SOURCE_PREVIEW_LIMIT) && <p>
                  {sourcePreview.length > SOURCE_PREVIEW_LIMIT ? "Showing the first 16,000 preview characters. " : ""}
                  {format === "markdown" ? "The saved file contains the full image data." : "The saved file contains the full text."}
                </p>}
              </div>
            ) : mode === "cover" ? (
              <div className={"books-preview-cover-art " + (selected.coverPanel === "wrap" && summary.cover === "layered" ? "spread" : "front")}>
                <CoverArtwork book={edition} layout={layout} panel={selected.coverPanel ?? "front"} />
              </div>
            ) : mode === "contents" ? (
              <ContentsPreview book={edition} entries={toc} epub={format === "epub"} />
            ) : (
              <>
                {selectedChapterId !== null && <div className="books-preview-section-bar">
                  <label className="books-preview-section-picker">
                    <span>Section</span>
                    <select aria-label="Preview section" value={selectedChapterId} onChange={(event) => setPreviewChapterId(Number(event.target.value))}>
                      {orderedChapters.map((chapter, index) => <option key={chapter.id} value={chapter.id}>{chapterTitleHeading(chapter, index, orderedChapters)}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => onOpenChapter(selectedChapterId)}>Edit section <ChevronRight size={13} /></button>
                </div>}
                <InteriorPreview book={edition} chapters={orderedChapters} chapterId={selectedChapterId} format={format} />
              </>
            )}
          </section>
        </div>
      </div>
      <PrintBook book={printEdition} chapters={chapters} toc={printToc} coverImage={format === "print" && printCover?.book === book ? printCover.source : undefined} />
    </>
  );
}

export const PrintBook = memo(function PrintBook({ book, chapters, toc, coverImage }: { book: Book; chapters: Chapter[]; toc: TocEntry[]; coverImage?: string }) {
  const layout = layoutForBook(book);
  const orderedChapters = orderBookChapters(chapters);
  const chapterLayouts = new Map(orderedChapters.map((chapter) => [chapter.id, layoutForChapter(book, chapter)]));
  const titlePage = orderedChapters.find((chapter) => chapterIsOpeningPage(chapter.chapter_kind));
  const titleLayout = titlePage ? chapterLayouts.get(titlePage.id) ?? layout : layout;
  const front = frontMatterSections(book, chapters);
  const contentChapters = orderedChapters.filter((chapter) => chapter.id !== titlePage?.id);
  const back = backMatterSections(book, chapters);
  const namedPageCss = orderedChapters.map((chapter) => {
    const page = chapterLayouts.get(chapter.id) ?? layout;
    const name = `book-page-${chapter.id}`;
    return `@page ${name}{size:${trimCssSize(book.trim_size)};margin:${page.pageMargins.top}in ${page.pageMargins.right}in ${page.pageMargins.bottom}in ${page.pageMargins.left}in;}.${name}{page:${name};}`;
  }).join("");
  const coverMetricsForPrint = coverMetrics(book.trim_size, layout.cover);
  const coverPageSize = hasCoverDocument(layout.cover) ? `${coverMetricsForPrint.fullWidth}in ${coverMetricsForPrint.fullHeight}in` : trimCssSize(book.trim_size);
  const printCss = `@page{size:${trimCssSize(book.trim_size)};margin:${layout.pageMargins.top}in ${layout.pageMargins.right}in ${layout.pageMargins.bottom}in ${layout.pageMargins.left}in;}@page book-cover{size:${coverPageSize};margin:0;}.book-print-cover{page:book-cover;}.book-print-cover .cover-doc{box-shadow:none!important;}@media print{.book-print-cover .cover-doc{width:${coverMetricsForPrint.fullWidth}in!important;height:${coverMetricsForPrint.fullHeight}in!important;}}${namedPageCss}${paragraphStylesCss(layout, ".book-print-content")}`;
  const pageStyle = (page: typeof layout, background = page.pageColor) => ({ ...manuscriptStyle({ ...book, layout_json: serializeBookLayout(page) }), backgroundColor: background });
  return createPortal(
    <div className="book-print-root" style={manuscriptStyle(book)}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <div className="book-print-content">
        <section className={`book-print-cover ${layout.cover.enabled ? "cover-included" : "cover-disabled"}`}>
          {coverImage ? <img className="book-print-cover-image" src={coverImage} alt={`${book.title || "Manuscript"} cover spread`} style={{ width: `${coverMetricsForPrint.fullWidth}in` }} />
            : <CoverArtwork book={book} layout={layout} fit={false} />}
        </section>
        <section id={titlePage ? sectionAnchorId(titlePage.id) : undefined} className={"print-title-page " + (titlePage ? `book-page-${titlePage.id}` : "")} style={pageStyle(titleLayout)}>
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
    </div>,
    document.body,
  );
});
