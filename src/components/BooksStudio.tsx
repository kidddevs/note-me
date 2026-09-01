import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Info,
  LayoutList,
  Library,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Printer,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Book, BookInput, Chapter, ChapterKind } from "../lib/types";
import { bookExportChecks } from "../lib/bookExport";
import { DEFAULT_BOOK_TYPOGRAPHY, layoutForBook, layoutSectionKey, layoutTokenText, pageNumberForSection, pageRuleFor, serializeBookLayout, type BookLayout, type BookPageNumberStyle, type BookTextRole, type BookTextStyle, type BookTypography } from "../lib/bookLayout";
import {
  addMarkdownHeadingAnchors,
  backMatterSections,
  buildBookToc,
  frontMatterSections,
  headingAnchorId,
  matterAnchorId,
  orderBookChapters,
  sectionAnchorId,
  type TocEntry,
} from "../lib/bookToc";
import { useBooks } from "../store/books";
import { useWorkspace } from "../store/workspace";
import { notify } from "../store/toast";
import { ManuscriptScreen } from "./BooksStudioEditor";
import { OutlineScreen, SectionsRail } from "./BooksStudioOutline";

export type StudioScreen = "library" | "manuscript" | "outline" | "settings" | "export";
export type EditorView = "write" | "preview";
export type ExportFormat = "markdown" | "html" | "epub" | "docx" | "txt";
export type MatterFocus = "front" | "back";

interface ConfirmationRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = useCallback(() => {
    if (busy) return;
    setRequest(null);
    setError("");
    requestAnimationFrame(() => restoreFocusRef.current?.focus());
  }, [busy]);

  const ask = useCallback((next: ConfirmationRequest, restoreFocus?: HTMLElement | null) => {
    restoreFocusRef.current = restoreFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setError("");
    setRequest(next);
  }, []);

  useEffect(() => {
    if (request) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [request]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
    if (!focusable.length) return;
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

  const accept = async () => {
    if (!request || busy) return;
    setBusy(true);
    setError("");
    try {
      await request.onConfirm();
      setRequest(null);
      requestAnimationFrame(() => restoreFocusRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const dialog = request ? (
    <div className="modal-overlay books-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className="books-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} onKeyDown={onKeyDown}>
        <div className="books-confirm-mark" aria-hidden="true"><Trash2 size={18} /></div>
        <div className="books-confirm-copy">
          <span className="books-eyebrow">Please confirm</span>
          <h2 id={titleId}>{request.title}</h2>
          <p id={descriptionId}>{request.description}</p>
          {error && <p className="books-confirm-error" role="alert">{error}</p>}
        </div>
        <div className="books-confirm-actions">
          <button ref={cancelRef} className="books-confirm-cancel" onClick={close} disabled={busy}>Keep it</button>
          <button className="books-confirm-delete" onClick={() => void accept()} disabled={busy}>{busy ? "Deleting…" : request.confirmLabel}</button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}

export function handleTabListKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']:not([disabled])"));
  if (!tabs.length) return;
  const current = Math.max(0, tabs.findIndex((tab) => tab === document.activeElement));
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

export function handleMenuKeyDown(event: React.KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not([disabled])"));
  if (!items.length) return;
  const current = Math.max(0, items.findIndex((item) => item === document.activeElement));
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  event.preventDefault();
  items[next].focus();
}

const TRIM_SIZES = [
  { value: "5x8", label: "5 x 8 in", description: "Compact trade" },
  { value: "5.25x8", label: "5.25 x 8 in", description: "Classic paperback" },
  { value: "6x9", label: "6 x 9 in", description: "Standard novel" },
  { value: "5.83x8.27", label: "A5", description: "International trade" },
  { value: "8.27x11.69", label: "A4", description: "Workbook / proof" },
  { value: "8.5x11", label: "US Letter", description: "Manuscript / print" },
];

export const FONT_OPTIONS = [
  { value: "serif", label: "Editorial Serif", css: "Georgia, 'Times New Roman', serif" },
  { value: "humanist", label: "Humanist", css: "Palatino, 'Palatino Linotype', serif" },
  { value: "sans", label: "Modern Sans", css: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" },
  { value: "mono", label: "Typewriter", css: "'SF Mono', 'Courier New', monospace" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "revising", label: "In revision" },
  { value: "ready", label: "Ready for export" },
  { value: "published", label: "Published" },
];

export const CHAPTER_KIND_OPTIONS: { value: ChapterKind; label: string; group: "front" | "story" | "back" }[] = [
  { value: "title_page", label: "Title page", group: "front" },
  { value: "dedication", label: "Dedication", group: "front" },
  { value: "epigraph", label: "Epigraph", group: "front" },
  { value: "copyright", label: "Copyright", group: "front" },
  { value: "prologue", label: "Prologue", group: "story" },
  { value: "chapter", label: "Chapter", group: "story" },
  { value: "interlude", label: "Interlude", group: "story" },
  { value: "appendix", label: "Appendix", group: "back" },
  { value: "acknowledgements", label: "Acknowledgements", group: "back" },
  { value: "about_author", label: "About the author", group: "back" },
];

const EXPORT_OPTIONS: { value: ExportFormat; label: string; description: string; extension: string }[] = [
  { value: "epub", label: "EPUB 3", description: "Reflowable ebook for Kindle apps, Apple Books, Kobo, and readers", extension: ".epub" },
  { value: "docx", label: "Word document", description: "Editable manuscript for editors, agents, and collaborators", extension: ".docx" },
  { value: "html", label: "Styled HTML", description: "A polished web-ready soft copy with print dimensions", extension: ".html" },
  { value: "markdown", label: "Markdown", description: "Portable source with front matter and chapter structure", extension: ".md" },
  { value: "txt", label: "Plain text", description: "Clean submission copy without styling", extension: ".txt" },
];

const PAGE_NUMBER_STYLE_OPTIONS: { value: BookPageNumberStyle; label: string }[] = [
  { value: "arabic", label: "Arabic · 1, 2, 3" },
  { value: "roman-lower", label: "Lowercase Roman · i, ii, iii" },
  { value: "roman-upper", label: "Uppercase Roman · I, II, III" },
  { value: "custom", label: "Custom format" },
];

const PAGE_START_OPTIONS = [
  { value: "opening", label: "Opening pages" },
  { value: "contents", label: "Contents page" },
  { value: "story", label: "Story" },
  { value: "closing", label: "Closing pages" },
] as const;

function trimCssSize(trimSize: string) {
  const [width, height] = trimSize.split("x");
  return `${width ?? 6}in ${height ?? 9}in`;
}

function fontCss(fontFamily: string) {
  const preset = FONT_OPTIONS.find((font) => font.value === fontFamily);
  if (preset) return preset.css;
  const custom = fontFamily.replace(/[^a-z0-9\s,'"_-]/gi, "").trim();
  return custom || FONT_OPTIONS[0].css;
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function imageMimeType(path: string) {
  const extension = path.split(".").pop()?.toLocaleLowerCase();
  return ({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function imageAltText(path: string) {
  return (path.split(/[\\/]/).pop() ?? "Image")
    .replace(/\.[^.]+$/, "")
    .replace(/[\[\]]/g, " ")
    .trim() || "Image";
}

export function imageDataUri(mime: string, bytes: Uint8Array) {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export async function imageFileToMarkdown(file: File) {
  const mime = file.type || imageMimeType(file.name);
  const supported = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
  if (!supported.includes(mime)) throw new Error("Choose a PNG, JPEG, GIF, WebP, or SVG image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose an image smaller than 12 MB.");
  return `![${imageAltText(file.name)}](${imageDataUri(mime, new Uint8Array(await file.arrayBuffer()))})\n`;
}

function plainTextContent(value: string) {
  return value
    .replace(/:::\s*(chart|graph)\s*\n([\s\S]*?)\n:::/gi, (_match, _kind: string, body: string) => {
      const chart = chartDataFromJson(body);
      return chart?.title ? `[Chart: ${chart.title}]` : "[Chart]";
    })
    .replace(/:::\s*table\s*\n([\s\S]*?)\n:::/gi, (_match, body: string) => {
      const parsed = richJsonLine(body);
      const options = objectValue(parsed.value) && typeof parsed.value.caption === "string" ? parsed.value.caption : "Table";
      return `[${options}]`;
    })
    .replace(/:::\s*callout\s*\n([\s\S]*?)\n:::/gi, (_match, body: string) => {
      const parsed = richJsonLine(body);
      const lines = body.split(/\r?\n/).filter((_line, index) => index !== parsed.index);
      return lines.join(" ").trim();
    })
    .replace(/!\[([^\]]*)\]\((?:data:image\/|https?:\/\/)[^)]+\)(?:\{[^}]*\})?/gi, (_match, alt: string) => alt ? `[Image: ${alt}]` : "[Image]")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)]+\)/gi, "$1")
    .replace(/\s*<!--\s*note-me:layout\s+width=\d{1,3}\s+align=(?:left|center|right)\s*-->/gi, "");
}

export function findOccurrences(text: string, query: string) {
  const normalizedQuery = query.toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const normalizedText = text.toLocaleLowerCase();
  const matches: { start: number; end: number }[] = [];
  let start = 0;
  while (start < normalizedText.length) {
    const match = normalizedText.indexOf(normalizedQuery, start);
    if (match === -1) break;
    matches.push({ start: match, end: match + normalizedQuery.length });
    start = match + Math.max(1, normalizedQuery.length);
  }
  return matches;
}

export function chapterKindLabel(kind: string) {
  return CHAPTER_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "Chapter";
}

export function chapterGroup(kind: ChapterKind) {
  return CHAPTER_KIND_OPTIONS.find((option) => option.value === kind)?.group ?? "story";
}

function chapterPageBand(chapter: Chapter) {
  const group = chapterGroup(chapter.chapter_kind);
  return group === "front" ? "opening" : group === "back" ? "closing" : "story";
}

function chapterBandOrdinal(chapters: Chapter[], index: number) {
  const band = chapterPageBand(chapters[index]);
  return chapters.slice(0, index).filter((chapter) => chapterPageBand(chapter) === band).length;
}

export function chapterDisplayLabel(chapter: Chapter, index: number, chapters?: Chapter[]) {
  return chapter.chapter_kind === "chapter" ? `Chapter ${chapters ? chapterNumberFor(chapters, index) : index + 1}` : chapterKindLabel(chapter.chapter_kind);
}

function sameSectionLabel(left: string, right: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalize(left) === normalize(right);
}

function chapterHeading(chapter: Chapter, index: number, chapters: Chapter[]) {
  const label = chapterDisplayLabel(chapter, index, chapters);
  const title = chapter.title.trim();
  return !title || sameSectionLabel(title, label) ? label : `${label}: ${title}`;
}

function chapterTitleHeading(chapter: Chapter, index: number, chapters: Chapter[]) {
  const label = chapterDisplayLabel(chapter, index, chapters);
  const title = chapter.title.trim();
  return !title || sameSectionLabel(title, label) ? label : title;
}

function chapterHasDistinctTitle(chapter: Chapter, index: number, chapters: Chapter[]) {
  const title = chapter.title.trim();
  return Boolean(title) && !sameSectionLabel(title, chapterDisplayLabel(chapter, index, chapters));
}

function defaultChapterTitle(kind: ChapterKind, chapterNumber: number) {
  if (kind === "chapter") return `Chapter ${chapterNumber}`;
  return chapterKindLabel(kind);
}

function formatUpdated(value: string) {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return "Recently edited";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function bookInputFromBook(book: Book, layoutJson = book.layout_json): BookInput {
  return {
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    description: book.description,
    genre: book.genre,
    status: book.status,
    trimSize: book.trim_size,
    fontFamily: book.font_family,
    fontSize: book.font_size,
    lineHeight: book.line_height,
    paragraphSpacing: book.paragraph_spacing,
    margin: book.margin,
    wordGoal: book.word_goal,
    coverColor: book.cover_color,
    dedication: book.dedication,
    epigraph: book.epigraph,
    copyrightText: book.copyright_text,
    acknowledgements: book.acknowledgements,
    tocEnabled: book.toc_enabled,
    tocTitle: book.toc_title,
    tocDepth: book.toc_depth,
    tocIncludeFrontMatter: book.toc_include_front_matter,
    tocIncludeBackMatter: book.toc_include_back_matter,
    layoutJson,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type ImageRadius = "none" | "soft" | "round";
type ImageAlign = "left" | "center" | "right";
export type RichAlign = "left" | "center" | "right";

export interface ImagePresentation {
  radius: ImageRadius;
  align: ImageAlign;
  width: number;
}

export interface RichPresentation {
  width: number;
  align: RichAlign;
}

export const DEFAULT_RICH_PRESENTATION: RichPresentation = { width: 100, align: "left" };

const DEFAULT_IMAGE_PRESENTATION: ImagePresentation = { radius: "none", align: "center", width: 100 };

function parseImageAttributes(value?: string): ImagePresentation {
  const result = { ...DEFAULT_IMAGE_PRESENTATION };
  for (const token of (value ?? "").split(/\s+/).filter(Boolean)) {
    const [key, raw] = token.split("=");
    if (key === "radius" && ["none", "soft", "round"].includes(raw as string)) result.radius = raw as ImageRadius;
    if (key === "align" && ["left", "center", "right"].includes(raw as string)) result.align = raw as ImageAlign;
    if (key === "width" && raw) result.width = Math.min(100, Math.max(20, Number(raw) || 100));
  }
  return result;
}

function imageAttributesText(presentation: ImagePresentation) {
  const attributes = [
    presentation.radius !== "none" ? `radius=${presentation.radius}` : "",
    presentation.align !== "center" ? `align=${presentation.align}` : "",
    presentation.width !== 100 ? `width=${presentation.width}` : "",
  ].filter(Boolean);
  return attributes.length ? `{${attributes.join(" ")}}` : "";
}

export function imageMarkdown(alt: string, source: string, presentation: ImagePresentation) {
  return `![${alt.replace(/[\[\]\r\n]/g, " ")}](${source})${imageAttributesText(presentation)}`;
}

function parseImageLine(line: string) {
  const match = /^(\s*)!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?\s*$/.exec(line);
  if (!match) return null;
  return { indent: match[1], alt: match[2], source: match[3], presentation: parseImageAttributes(match[4]) };
}

function inlineHtml(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?/g, (_match, alt: string, source: string, attributes: string | undefined) => {
      if (!/^(?:https?:\/\/|data:image\/)/i.test(source)) return "";
      const presentation = parseImageAttributes(attributes);
      return `<img class="book-image radius-${presentation.radius} align-${presentation.align}" style="max-width:${presentation.width}%" src="${source}" alt="${alt}" loading="lazy" />`;
    })
     .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, source: string) => /^(?:https?:\/\/|mailto:|#)/i.test(source) ? `<a href="${source}">${label}</a>` : label);
}

const NESTED_OPEN_MARKER = String.fromCharCode(1);
const NESTED_CLOSE_MARKER = String.fromCharCode(2);

function paragraphInlineHtml(value: string, style: BookTextStyle) {
  if (style.nestedStyle === "none" || style.nestedWords < 1) return inlineHtml(value);
  let words = style.nestedWords;
  const marked = value.replace(/\S+/g, (word) => {
    if (words < 1) return word;
    words -= 1;
    return `${NESTED_OPEN_MARKER}${word}${NESTED_CLOSE_MARKER}`;
  });
  return inlineHtml(marked)
    .split(NESTED_OPEN_MARKER).join(`<span class="book-nested-style nested-${style.nestedStyle}">`)
    .split(NESTED_CLOSE_MARKER).join("</span>");
}

export type RichBlockKind = "table" | "chart" | "callout";
export type ChartKind = "bar" | "line" | "area" | "donut" | "stat";
export type ChartPalette = "earth" | "botanical" | "berry" | "ink" | "sunset";
export type TableAlign = "left" | "center" | "right";

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  type: ChartKind;
  title: string;
  subtitle: string;
  labels: string[];
  series: ChartSeries[];
  palette: ChartPalette;
  showLegend: boolean;
  showGrid: boolean;
  width: number;
  align: RichAlign;
}

export interface TableData {
  caption: string;
  align: TableAlign;
  striped: boolean;
  compact: boolean;
  width: number;
}

const CHART_PALETTES: Record<ChartPalette, string[]> = {
  earth: ["#a56b3e", "#6f7f6d", "#874e47", "#b6956e", "#4c5a4a"],
  botanical: ["#5e7560", "#9a6b4f", "#758b78", "#c1a67d", "#405548"],
  berry: ["#874e47", "#b77870", "#6d3e47", "#cf9a8f", "#4d3037"],
  ink: ["#29231e", "#756e62", "#aaa092", "#4c4640", "#c8c0b6"],
  sunset: ["#bb7046", "#d19a54", "#8f5b57", "#6e7166", "#d0b59a"],
};

const CHART_KINDS: ChartKind[] = ["bar", "line", "area", "donut", "stat"];
export const CHART_PALETTE_NAMES: ChartPalette[] = ["earth", "botanical", "berry", "ink", "sunset"];

export function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function richPresentationFromValue(value: unknown, fallback: RichPresentation = DEFAULT_RICH_PRESENTATION): RichPresentation {
  if (!objectValue(value)) return { ...fallback };
  return {
    width: typeof value.width === "number" && Number.isFinite(value.width) ? Math.min(100, Math.max(20, value.width)) : fallback.width,
    align: ["left", "center", "right"].includes(String(value.align)) ? String(value.align) as RichAlign : fallback.align,
  };
}

function chartDataFromValue(value: unknown): ChartData | null {
  if (!objectValue(value)) return null;
  const type = CHART_KINDS.includes(value.type as ChartKind) ? value.type as ChartKind : "bar";
  const palette = CHART_PALETTE_NAMES.includes(value.palette as ChartPalette) ? value.palette as ChartPalette : "earth";
  const labels = Array.isArray(value.labels) ? value.labels.slice(0, 16).map((label) => String(label).slice(0, 40)) : [];
  const sourceSeries = Array.isArray(value.series) ? value.series : [];
  const series = sourceSeries.slice(0, 5).map((item, index) => {
    const source = objectValue(item) ? item : {};
    const values = Array.isArray(source.values) ? source.values.slice(0, 16).map((number) => typeof number === "number" && Number.isFinite(number) ? number : 0) : [];
    return { name: String(source.name ?? `Series ${index + 1}`).slice(0, 40), values };
  }).filter((item) => item.values.length > 0);
  const safeLabels = labels.length ? labels : (series[0]?.values.map((_value, index) => `Item ${index + 1}`) ?? []);
  const safeSeries = series.length ? series : [{ name: "Value", values: safeLabels.map(() => 0) }];
  const labelCount = Math.max(1, Math.min(16, safeLabels.length || Math.max(...safeSeries.map((item) => item.values.length), 1)));
  return {
    type,
    title: String(value.title ?? "").slice(0, 120),
    subtitle: String(value.subtitle ?? "").slice(0, 180),
    labels: Array.from({ length: labelCount }, (_item, index) => safeLabels[index] ?? `Item ${index + 1}`),
    series: safeSeries.map((item) => ({ ...item, values: Array.from({ length: labelCount }, (_value, index) => item.values[index] ?? 0) })),
    palette,
    showLegend: typeof value.showLegend === "boolean" ? value.showLegend : safeSeries.length > 1,
    showGrid: typeof value.showGrid === "boolean" ? value.showGrid : true,
    ...richPresentationFromValue(value),
  };
}

function chartDataFromJson(value: string) {
  try {
    return chartDataFromValue(JSON.parse(value));
  } catch {
    return null;
  }
}

export function defaultChartData(): ChartData {
  return {
    type: "bar",
    title: "A considered comparison",
    subtitle: "Replace the sample values in the inspector.",
    labels: ["First", "Second", "Third", "Fourth"],
    series: [{ name: "Value", values: [28, 42, 35, 54] }],
    palette: "earth",
    showLegend: false,
    showGrid: true,
    width: 100,
    align: "center",
  };
}

export function richJsonLine(value: string) {
  const index = value.split(/\r?\n/).findIndex((line) => line.trim());
  if (index === -1) return { value: null, index: -1 };
  const lines = value.split(/\r?\n/);
  const candidate = lines[index].trim();
  if (!candidate.startsWith("{")) return { value: null, index: -1 };
  try {
    return { value: JSON.parse(candidate) as unknown, index };
  } catch {
    return { value: null, index };
  }
}

export function splitTableCells(line: string) {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  for (const character of source) {
    if (character === "|" && !escaped) {
      cells.push(cell.trim().replace(/\\\|/g, "|"));
      cell = "";
      continue;
    }
    if (character === "\\" && !escaped) {
      escaped = true;
      cell += character;
      continue;
    }
    escaped = false;
    cell += character;
  }
  cells.push(cell.trim().replace(/\\\|/g, "|"));
  return cells;
}

export function tableSeparator(line: string) {
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableRow(line: string) {
  return line.includes("|") && line.trim().length > 0;
}

function tableAlignments(separator: string) {
  return splitTableCells(separator).map((cell): TableAlign => cell.startsWith(":") ? (cell.endsWith(":") ? "center" : "left") : cell.endsWith(":") ? "right" : "left");
}

function renderTable(lines: string[], options: TableData = { caption: "", align: "left", striped: false, compact: false, width: 100 }) {
  if (lines.length < 2 || !tableSeparator(lines[1])) return `<pre class="rich-block-fallback">${escapeHtml(lines.join("\n"))}</pre>`;
  const headers = splitTableCells(lines[0]);
  const alignments = tableAlignments(lines[1]);
  const rows = lines.slice(2).filter(tableRow).map(splitTableCells);
  const classes = ["rich-table", `align-${options.align}`, options.striped ? "striped" : "", options.compact ? "compact" : ""].filter(Boolean).join(" ");
  const cellStyle = (index: number) => ` style="text-align:${alignments[index] ?? "left"}"`;
  return `<figure class="rich-table-figure align-${options.align}" style="max-width:${options.width}%">${options.caption ? `<figcaption>${inlineHtml(options.caption)}</figcaption>` : ""}<div class="rich-table-scroll"><table class="${classes}"><thead><tr>${headers.map((header, index) => `<th scope="col"${cellStyle(index)}>${inlineHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_header, index) => `<td${cellStyle(index)}>${inlineHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></figure>`;
}

function chartNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function chartDonutPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const startX = cx + radius * Math.cos(start);
  const startY = cy + radius * Math.sin(start);
  const endX = cx + radius * Math.cos(end);
  const endY = cy + radius * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)} Z`;
}

function renderChart(data: ChartData) {
  const colors = CHART_PALETTES[data.palette];
  const width = 620;
  const height = data.type === "stat" ? 260 : 330;
  const left = 54;
  const right = 22;
  const top = data.title ? 58 : 28;
  const bottom = data.type === "donut" ? 24 : 48;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(1, ...data.series.flatMap((series) => series.values.map((value) => Math.abs(value))));
  const scaleY = (value: number) => top + chartHeight - (value / maxValue) * chartHeight;
  const labels = data.labels.map((label, index) => `<text x="${(left + (index + 0.5) * (chartWidth / data.labels.length)).toFixed(1)}" y="${height - 13}" text-anchor="middle" class="chart-label">${escapeHtml(label)}</text>`).join("");
  const grid = data.showGrid && data.type !== "donut" ? Array.from({ length: 5 }, (_item, index) => {
    const value = maxValue * (index / 4);
    const y = scaleY(value);
    return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" class="chart-grid"/><text x="${left - 9}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="chart-value">${escapeHtml(chartNumber(value))}</text>`;
  }).join("") : "";
  let marks = "";
  if (data.type === "bar") {
    const groupWidth = chartWidth / data.labels.length;
    const barWidth = Math.min(34, (groupWidth * 0.72) / data.series.length);
    marks = data.series.map((series, seriesIndex) => series.values.map((value, index) => {
      const x = left + index * groupWidth + groupWidth * 0.14 + seriesIndex * barWidth;
      const y = scaleY(Math.max(0, value));
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(3, barWidth - 3).toFixed(1)}" height="${Math.max(0, top + chartHeight - y).toFixed(1)}" rx="3" fill="${colors[seriesIndex % colors.length]}"/>`;
    }).join("")).join("");
  } else if (data.type === "line" || data.type === "area") {
    const step = data.labels.length > 1 ? chartWidth / (data.labels.length - 1) : chartWidth;
    marks = data.series.map((series, seriesIndex) => {
      const points = series.values.map((value, index) => `${(left + (data.labels.length > 1 ? index * step : chartWidth / 2)).toFixed(1)},${scaleY(Math.max(0, value)).toFixed(1)}`).join(" ");
      const area = data.type === "area" ? `<polygon points="${left},${top + chartHeight} ${points} ${left + chartWidth},${top + chartHeight}" fill="${colors[seriesIndex % colors.length]}" opacity=".13"/>` : "";
      const dots = series.values.map((value, index) => `<circle cx="${(left + (data.labels.length > 1 ? index * step : chartWidth / 2)).toFixed(1)}" cy="${scaleY(Math.max(0, value)).toFixed(1)}" r="4" fill="${colors[seriesIndex % colors.length]}"/>`).join("");
      return `${area}<polyline points="${points}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
    }).join("");
  } else if (data.type === "donut") {
    const values = data.series[0].values.map((value) => Math.max(0, value));
    const total = Math.max(1, values.reduce((sum, value) => sum + value, 0));
    let cursor = -Math.PI / 2;
    marks = values.map((value, index) => {
      const next = cursor + (value / total) * Math.PI * 2;
      const path = chartDonutPath(width / 2, top + chartHeight / 2, Math.min(92, chartHeight / 2), cursor, next);
      cursor = next;
      return `<path d="${path}" fill="${colors[index % colors.length]}"/>`;
    }).join("") + `<circle cx="${width / 2}" cy="${top + chartHeight / 2}" r="48" fill="var(--book-paper, #fffaf3)"/>`;
  } else {
    const first = data.series[0]?.values[0] ?? 0;
    marks = `<text x="${width / 2}" y="${top + 103}" text-anchor="middle" class="chart-stat-value">${escapeHtml(chartNumber(first))}</text><text x="${width / 2}" y="${top + 135}" text-anchor="middle" class="chart-stat-label">${escapeHtml(data.labels[0] ?? "Value")}</text>`;
  }
  const legend = data.showLegend ? `<div class="rich-chart-legend">${data.series.map((series, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(series.name)}</span>`).join("")}</div>` : "";
  return `<figure class="rich-chart rich-chart-${data.type} align-${data.align}" style="max-width:${data.width}%">${data.title ? `<figcaption><strong>${escapeHtml(data.title)}</strong>${data.subtitle ? `<small>${escapeHtml(data.subtitle)}</small>` : ""}</figcaption>` : ""}<svg class="rich-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(data.title || `${data.type} chart`)}">${grid}${marks}${labels}</svg>${legend}</figure>`;
}

function renderCallout(body: string, typography: BookTypography = DEFAULT_BOOK_TYPOGRAPHY) {
  const parsed = richJsonLine(body);
  const options = objectValue(parsed.value) ? parsed.value : {};
  const contentLines = body.split(/\r?\n/).filter((_line, index) => index !== parsed.index);
  const tone = ["note", "tip", "warning", "quote"].includes(String(options.tone)) ? String(options.tone) : "note";
  const title = typeof options.title === "string" ? options.title : "Note";
  const presentation = richPresentationFromValue(options);
  return `<aside class="rich-callout ${tone} align-${presentation.align}" style="max-width:${presentation.width}%"><strong>${escapeHtml(title)}</strong><div>${markdownToHtml(contentLines.join("\n"), undefined, typography)}</div></aside>`;
}

export function tableDataFromValue(value: unknown): TableData {
  if (!objectValue(value)) return { caption: "", align: "left", striped: false, compact: false, width: 100 };
  return {
    caption: typeof value.caption === "string" ? value.caption.slice(0, 120) : "",
    align: ["left", "center", "right"].includes(String(value.align)) ? String(value.align) as TableAlign : "left",
    striped: value.striped === true,
    compact: value.compact === true,
    width: typeof value.width === "number" && Number.isFinite(value.width) ? Math.min(100, Math.max(20, value.width)) : 100,
  };
}

function renderRichBlock(kind: RichBlockKind, body: string, typography: BookTypography = DEFAULT_BOOK_TYPOGRAPHY) {
  if (kind === "chart") {
    const data = chartDataFromJson(body);
    return data ? renderChart(data) : `<pre class="rich-block-fallback">${escapeHtml(body)}</pre>`;
  }
  if (kind === "callout") return renderCallout(body, typography);
  const parsed = richJsonLine(body);
  const options = tableDataFromValue(parsed.value);
  const lines = body.split(/\r?\n/).filter((_line, index) => index !== parsed.index);
  return renderTable(lines, options);
}

export function markdownToHtml(markdown: string, anchorPrefix?: string, typography: BookTypography = DEFAULT_BOOK_TYPOGRAPHY) {
  const lines = markdown.replace(/\r\n/g, "\n").replace(CANVAS_LAYOUT_COMMENT_PATTERN, "").split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  let fencedCode: string[] | null = null;
  let richBlock: { kind: RichBlockKind; lines: string[]; closing: string } | null = null;
  let headingOrdinal = 0;

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      const style = typography.paragraph;
      const classes = ["book-paragraph", style.dropCap ? "has-drop-cap" : ""].filter(Boolean).join(" ");
      html.push(`<p class="${classes}">${paragraphInlineHtml(paragraph.join(" "), style)}</p>`);
      paragraph = [];
    }
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (richBlock) {
      if (trimmed === richBlock.closing) {
        html.push(renderRichBlock(richBlock.kind, richBlock.lines.join("\n"), typography));
        richBlock = null;
      } else {
        richBlock.lines.push(line);
      }
      continue;
    }
    const directive = /^:::\s*(table|chart|callout)\s*$/i.exec(trimmed);
    const chartFence = /^```(?:chart|graph)\s*$/i.test(trimmed);
    if (!fencedCode && (directive || chartFence)) {
      flushParagraph();
      closeList();
      richBlock = { kind: (directive?.[1].toLocaleLowerCase() ?? "chart") as RichBlockKind, lines: [], closing: directive ? ":::" : "```" };
      continue;
    }
    if (!fencedCode && tableRow(line) && lineIndex + 1 < lines.length && tableSeparator(lines[lineIndex + 1])) {
      flushParagraph();
      closeList();
      const tableLines = [line, lines[lineIndex + 1]];
      lineIndex += 2;
      while (lineIndex < lines.length && tableRow(lines[lineIndex])) {
        tableLines.push(lines[lineIndex]);
        lineIndex += 1;
      }
      lineIndex -= 1;
      html.push(renderTable(tableLines));
      continue;
    }
    if (/^(?:```|~~~)/.test(trimmed)) {
      flushParagraph();
      closeList();
      if (fencedCode) {
        html.push(`<pre><code>${escapeHtml(fencedCode.join("\n"))}</code></pre>`);
        fencedCode = null;
      } else {
        fencedCode = [];
      }
      continue;
    }
    if (fencedCode) {
      fencedCode.push(line);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (!trimmed) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length, 6);
      headingOrdinal += 1;
      const id = anchorPrefix ? ` id="${headingAnchorId(anchorPrefix, headingOrdinal)}"` : "";
      html.push(`<h${level} class="book-heading-${level}"${id}>${inlineHtml(heading[2])}</h${level}>`);
    } else if (/^(---|\*\*\*)$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push("<div class=\"scene-break\">* * *</div>");
    } else if (bullet || numbered) {
      flushParagraph();
      const nextList = bullet ? "ul" : "ol";
      if (list !== nextList) {
        closeList();
        list = nextList;
        html.push(`<${list}>`);
      }
      html.push(`<li>${inlineHtml((bullet ?? numbered)![1])}</li>`);
    } else if (trimmed.startsWith(">")) {
      flushParagraph();
      closeList();
      html.push(`<blockquote class="book-quote">${inlineHtml(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
    } else {
      paragraph.push(trimmed);
    }
  }
  if (richBlock) html.push(`<pre class="rich-block-fallback">${escapeHtml([`${richBlock.closing === ":::" ? `:::${richBlock.kind}` : "```chart"}`, ...richBlock.lines].join("\n"))}</pre>`);
  if (fencedCode) html.push(`<pre><code>${escapeHtml(fencedCode.join("\n"))}</code></pre>`);
  flushParagraph();
  closeList();
  return html.join("\n");
}

export interface RichBlockRange {
  kind: RichBlockKind;
  start: number;
  end: number;
  body: string;
}

export interface EditorContext {
  kind: "none" | "title" | "heading" | "paragraph" | "quote" | "image" | RichBlockKind;
  role?: BookTextRole;
  label: string;
  start: number;
  end: number;
  source: string;
  blockBody?: string;
  image?: ReturnType<typeof parseImageLine>;
  tableLines?: string[];
  tableOptions?: TableData;
  chart?: ChartData | null;
  calloutTitle?: string;
  calloutTone?: string;
  calloutPresentation?: RichPresentation;
  presentation?: RichPresentation;
}

function contentLines(value: string) {
  const lines = value.split("\n");
  let offset = 0;
  return lines.map((text) => {
    const line = { text, start: offset, end: offset + text.length };
    offset += text.length + 1;
    return line;
  });
}

function selectionIntersects(start: number, end: number, rangeStart: number, rangeEnd: number) {
  return start <= rangeEnd && end >= rangeStart;
}

function richBlockAt(value: string, selectionStart: number, selectionEnd: number): RichBlockRange | null {
  const lines = contentLines(value);
  for (let index = 0; index < lines.length; index += 1) {
    const directive = /^:::\s*(table|chart|callout)\s*$/i.exec(lines[index].text.trim());
    const chartFence = /^```(?:chart|graph)\s*$/i.test(lines[index].text.trim());
    if (!directive && !chartFence) continue;
    const closing = directive ? ":::" : "```";
    const closingIndex = lines.findIndex((line, lineIndex) => lineIndex > index && line.text.trim() === closing);
    if (closingIndex === -1) continue;
    const start = lines[index].start;
    const end = lines[closingIndex].end;
    if (!selectionIntersects(selectionStart, selectionEnd, start, end)) continue;
    const bodyStart = lines[index].end + (lines[index].end < value.length ? 1 : 0);
    return { kind: (directive?.[1].toLocaleLowerCase() ?? "chart") as RichBlockKind, start, end, body: value.slice(bodyStart, lines[closingIndex].start) };
  }
  return null;
}

function tableContentFromBody(body: string) {
  const lines = body.split(/\r?\n/);
  const parsed = richJsonLine(body);
  return {
    lines: lines.filter((_line, index) => index !== parsed.index),
    options: tableDataFromValue(parsed.value),
  };
}

function tableAt(value: string, selectionStart: number, selectionEnd: number) {
  const lines = contentLines(value);
  const lineIndex = lines.findIndex((line) => selectionStart >= line.start && selectionStart <= line.end) ?? -1;
  if (lineIndex < 0 || !tableRow(lines[lineIndex].text)) return null;
  let first = lineIndex;
  while (first > 0 && tableRow(lines[first - 1].text)) first -= 1;
  if (!tableSeparator(lines[first + 1]?.text ?? "")) return null;
  let last = first + 1;
  while (last + 1 < lines.length && tableRow(lines[last + 1].text)) last += 1;
  const start = lines[first].start;
  const end = lines[last].end;
  if (!selectionIntersects(selectionStart, selectionEnd, start, end)) return null;
  return { start, end, source: value.slice(start, end), lines: lines.slice(first, last + 1).map((line) => line.text), options: tableDataFromValue(null) };
}

export function editorContextFor(value: string, selectionStart: number, selectionEnd: number, titleFocused = false): EditorContext {
  if (titleFocused) return { kind: "title", role: "title", label: "Section title", start: 0, end: value.length, source: value };
  const rich = richBlockAt(value, selectionStart, selectionEnd);
  if (rich) {
    if (rich.kind === "table") {
      const table = tableContentFromBody(rich.body);
      return { kind: "table", label: "Data table", start: rich.start, end: rich.end, source: value.slice(rich.start, rich.end), blockBody: rich.body, tableLines: table.lines, tableOptions: table.options };
    }
    if (rich.kind === "chart") return { kind: "chart", label: "Chart / graph", start: rich.start, end: rich.end, source: value.slice(rich.start, rich.end), blockBody: rich.body, chart: chartDataFromJson(rich.body) };
    const parsed = richJsonLine(rich.body);
    const options = objectValue(parsed.value) ? parsed.value : {};
    return { kind: "callout", label: "Callout", start: rich.start, end: rich.end, source: value.slice(rich.start, rich.end), blockBody: rich.body, calloutTitle: typeof options.title === "string" ? options.title : "Note", calloutTone: typeof options.tone === "string" ? options.tone : "note", calloutPresentation: richPresentationFromValue(options) };
  }
  const table = tableAt(value, selectionStart, selectionEnd);
  if (table) return { kind: "table", label: "Data table", start: table.start, end: table.end, source: table.source, tableLines: table.lines, tableOptions: table.options };
  const block = canvasBlocks(value).find((item) => selectionIntersects(selectionStart, selectionEnd, item.start, item.end));
  if (!block) return { kind: "none", label: "Nothing selected", start: selectionStart, end: selectionEnd, source: "" };
  if (block.kind === "image" && block.image) return { kind: "image", label: "Image", start: block.start, end: block.end, source: block.source, image: block.image };
  if (block.kind === "text") {
    const heading = block.level;
    if (heading) return { kind: "heading", role: `heading${heading}` as BookTextRole, label: `Heading ${heading}`, start: block.start, end: block.end, source: block.source, presentation: block.presentation };
    if (block.role === "quote") return { kind: "quote", role: "quote", label: "Quote", start: block.start, end: block.end, source: block.source, presentation: block.presentation };
    return { kind: "paragraph", role: "paragraph", label: "Paragraph", start: block.start, end: block.end, source: block.source, presentation: block.presentation };
  }
  return { kind: "none", label: "Nothing selected", start: selectionStart, end: selectionEnd, source: "" };
}

export function tableBlockText(lines: string[], options: TableData) {
  return `:::table\n${JSON.stringify(options)}\n${lines.join("\n")}\n:::`;
}

export function chartBlockText(data: ChartData) {
  return `:::chart\n${JSON.stringify(data)}\n:::`;
}

export function calloutBlockText(title: string, tone: string, content: string, presentation: RichPresentation = DEFAULT_RICH_PRESENTATION) {
  return `:::callout\n${JSON.stringify({ title, tone, ...presentation })}\n${content}\n:::`;
}

const CANVAS_LAYOUT_PATTERN = /\s*<!--\s*note-me:layout\s+width=(\d{1,3})\s+align=(left|center|right)\s*-->\s*$/i;
const CANVAS_LAYOUT_COMMENT_PATTERN = /\s*<!--\s*note-me:layout\s+width=\d{1,3}\s+align=(?:left|center|right)\s*-->/gi;

function canvasLayoutFromSource(source: string) {
  const match = CANVAS_LAYOUT_PATTERN.exec(source);
  if (!match || match.index === undefined) return { clean: source, suffix: "", presentation: { ...DEFAULT_RICH_PRESENTATION } };
  const clean = source.slice(0, match.index).replace(/\s+$/, "");
  return {
    clean,
    suffix: source.slice(clean.length),
    presentation: { width: Math.min(100, Math.max(20, Number(match[1]) || 100)), align: match[2] as RichAlign },
  };
}

function canvasLayoutComment(presentation: RichPresentation) {
  return presentation.width === 100 && presentation.align === DEFAULT_RICH_PRESENTATION.align ? "" : ` <!-- note-me:layout width=${presentation.width} align=${presentation.align} -->`;
}

export function canvasTextSource(source: string, presentation: RichPresentation) {
  const clean = canvasLayoutFromSource(source).clean.replace(/\s+$/, "");
  return `${clean}${canvasLayoutComment(presentation)}`;
}

export function addTableRow(lines: string[]) {
  const columnCount = splitTableCells(lines[0] ?? "").length;
  return [...lines, `| ${Array.from({ length: Math.max(1, columnCount) }, () => "").join(" | ")} |`];
}

export function addTableColumn(lines: string[]) {
  return lines.map((line, index) => {
    const cells = splitTableCells(line);
    cells.push(index === 1 ? "---" : "");
    return `| ${cells.join(" | ")} |`;
  });
}

export function removeTableRow(lines: string[]) {
  return lines.length > 2 ? lines.slice(0, -1) : lines;
}

export function removeTableColumn(lines: string[]) {
  if (splitTableCells(lines[0] ?? "").length <= 1) return lines;
  return lines.map((line) => `| ${splitTableCells(line).slice(0, -1).join(" | ")} |`);
}

function tableCellText(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
}

export function updateTableCell(lines: string[], rowIndex: number, columnIndex: number, value: string) {
  if (rowIndex === 1 || !lines[rowIndex]) return lines;
  const cells = splitTableCells(lines[rowIndex]);
  if (columnIndex >= cells.length) return lines;
  cells[columnIndex] = tableCellText(value);
  return lines.map((line, index) => index === rowIndex ? `| ${cells.join(" | ")} |` : line);
}

export interface CanvasBlock {
  kind: "text" | "image" | RichBlockKind;
  start: number;
  end: number;
  source: string;
  display: string;
  editPrefix: string;
  editSuffix: string;
  role?: BookTextRole;
  level?: number;
  image?: ReturnType<typeof parseImageLine>;
  tableLines?: string[];
  tableOptions?: TableData;
  chart?: ChartData | null;
  calloutTitle?: string;
  calloutTone?: string;
  calloutPresentation?: RichPresentation;
  presentation: RichPresentation;
}

function canvasBlockSpecial(value: string) {
  const trimmed = canvasLayoutFromSource(value).clean.trim();
  return Boolean(
    /^:::\s*(table|chart|callout)\s*$/i.test(trimmed)
    || /^```(?:chart|graph)\s*$/i.test(trimmed)
    || /^!\[[^\]]*\]\([^)]+\)(?:\{[^}]*\})?\s*$/.test(trimmed)
    || /^(#{1,6})\s+/.test(trimmed)
    || /^>\s?/.test(trimmed),
  );
}

export function canvasBlocks(value: string): CanvasBlock[] {
  const lines = contentLines(value);
  const blocks: CanvasBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineLayout = canvasLayoutFromSource(line.text);
    const trimmed = lineLayout.clean.trim();
    if (!trimmed) continue;
    const directive = /^:::\s*(table|chart|callout)\s*$/i.exec(trimmed);
    const chartFence = /^```(?:chart|graph)\s*$/i.test(trimmed);
    if (directive || chartFence) {
      const closing = directive ? ":::" : "```";
      const closingIndex = lines.findIndex((_candidate, candidateIndex) => candidateIndex > index && lines[candidateIndex].text.trim() === closing);
      if (closingIndex !== -1) {
        const start = line.start;
        const end = lines[closingIndex].end;
        const source = value.slice(start, end);
        const body = lines.slice(index + 1, closingIndex).map((item) => item.text).join("\n");
        const kind = (directive?.[1].toLocaleLowerCase() ?? "chart") as RichBlockKind;
        if (kind === "table") {
          const table = tableContentFromBody(body);
          blocks.push({ kind, start, end, source, display: source, editPrefix: "", editSuffix: "", tableLines: table.lines, tableOptions: table.options, presentation: { width: table.options.width, align: table.options.align } });
        } else if (kind === "chart") {
          const chart = chartDataFromJson(body);
          blocks.push({ kind, start, end, source, display: source, editPrefix: "", editSuffix: "", chart, presentation: chart ? { width: chart.width, align: chart.align } : { ...DEFAULT_RICH_PRESENTATION, align: "center" } });
        } else {
          const parsed = richJsonLine(body);
          const options = objectValue(parsed.value) ? parsed.value : {};
          const presentation = richPresentationFromValue(options);
          blocks.push({ kind, start, end, source, display: source, editPrefix: "", editSuffix: "", calloutTitle: typeof options.title === "string" ? options.title : "Note", calloutTone: typeof options.tone === "string" ? options.tone : "note", calloutPresentation: presentation, presentation });
        }
        index = closingIndex;
        continue;
      }
    }
    if (tableRow(line.text) && tableSeparator(lines[index + 1]?.text ?? "")) {
      const start = line.start;
      const tableLines = [line.text, lines[index + 1].text];
      index += 2;
      while (index < lines.length && tableRow(lines[index].text)) {
        tableLines.push(lines[index].text);
        index += 1;
      }
      index -= 1;
      const end = lines[index].end;
      blocks.push({ kind: "table", start, end, source: value.slice(start, end), display: value.slice(start, end), editPrefix: "", editSuffix: "", tableLines, tableOptions: tableDataFromValue(null), presentation: { ...DEFAULT_RICH_PRESENTATION } });
      continue;
    }
    const image = parseImageLine(line.text);
    if (image) {
      blocks.push({ kind: "image", start: line.start, end: line.end, source: line.text, display: line.text, editPrefix: "", editSuffix: "", image, presentation: { width: image.presentation.width, align: image.presentation.align } });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)(\s*)$/.exec(trimmed);
    if (heading) {
      const display = heading[2];
      const displayStart = lineLayout.clean.indexOf(display);
      blocks.push({ kind: "text", start: line.start, end: line.end, source: line.text, display, editPrefix: lineLayout.clean.slice(0, displayStart), editSuffix: `${heading[3]}${lineLayout.suffix}`, role: `heading${heading[1].length}` as BookTextRole, level: heading[1].length, presentation: lineLayout.presentation });
      continue;
    }
    const quote = /^>\s?(.+?)(\s*)$/.exec(trimmed);
    if (quote) {
      const display = quote[1];
      const displayStart = lineLayout.clean.indexOf(display);
      blocks.push({ kind: "text", start: line.start, end: line.end, source: line.text, display, editPrefix: lineLayout.clean.slice(0, displayStart), editSuffix: `${quote[2]}${lineLayout.suffix}`, role: "quote", presentation: lineLayout.presentation });
      continue;
    }
    const start = line.start;
    let end = line.end;
    while (index + 1 < lines.length && lines[index + 1].text.trim() && !canvasBlockSpecial(lines[index + 1].text)) {
      index += 1;
      end = lines[index].end;
    }
    const source = value.slice(start, end);
    const blockLayout = canvasLayoutFromSource(source);
    blocks.push({ kind: "text", start, end, source, display: blockLayout.clean, editPrefix: "", editSuffix: blockLayout.suffix, role: "paragraph", presentation: blockLayout.presentation });
  }
  return blocks;
}

export function tocTitle(book: Book) {
  return book.toc_title.trim() || "Contents";
}

function tocEntriesMarkdown(book: Book, chapters: Chapter[]) {
  const entries = buildBookToc(book, chapters);
  if (entries.length === 0) return "";
  return [
    `## ${tocTitle(book)}`,
    "",
    ...entries.map((entry) => `${"  ".repeat(Math.max(0, entry.level - 1))}- [${entry.label}](#${entry.id})`),
    "",
  ].join("\n");
}

function tocEntriesText(book: Book, chapters: Chapter[]) {
  const entries = buildBookToc(book, chapters);
  if (entries.length === 0) return [];
  return [tocTitle(book), "", ...entries.map((entry) => `${"  ".repeat(Math.max(0, entry.level - 1))}${entry.label}`), ""];
}

function tocEntriesHtml(book: Book, chapters: Chapter[]) {
  const entries = buildBookToc(book, chapters);
  if (entries.length === 0) return "";
  return `<nav class="book-toc" aria-label="${escapeHtml(tocTitle(book))}"><h2>${escapeHtml(tocTitle(book))}</h2><ol>${entries.map((entry) => `<li style="--toc-indent: ${Math.max(0, entry.level - 1)}"><a href="#${entry.id}">${escapeHtml(entry.label)}</a></li>`).join("")}</ol></nav>`;
}

function chapterNumberFor(chapters: Chapter[], index: number) {
  return chapters.slice(0, index + 1).filter((chapter) => chapter.chapter_kind === "chapter").length;
}

function bookMarkdown(book: Book, chapters: Chapter[]) {
  const frontMatter = [
    "---",
    `title: \"${book.title.replace(/\"/g, "\\\"")}\"`,
    `subtitle: \"${book.subtitle.replace(/\"/g, "\\\"")}\"`,
    `author: \"${book.author.replace(/\"/g, "\\\"")}\"`,
    `genre: \"${book.genre.replace(/\"/g, "\\\"")}\"`,
    `trim_size: \"${book.trim_size}\"`,
    `word_goal: ${book.word_goal}`,
    "---",
    "",
  ].join("\n");
  const orderedChapters = orderBookChapters(chapters);
  const chaptersMarkdown = orderedChapters.map((chapter, index) => {
    const displayLabel = chapterHeading(chapter, index, orderedChapters);
    return `<a id="${sectionAnchorId(chapter.id)}"></a>\n# ${displayLabel}\n\n${addMarkdownHeadingAnchors(chapter.content.trim(), sectionAnchorId(chapter.id))}\n`;
  }).join("\n");
  const front = frontMatterSections(book, chapters);
  const back = backMatterSections(book, chapters);
  const frontMarkdown = front.map((section) => `<a id="${matterAnchorId(section.key)}"></a>\n## ${section.title}\n\n${addMarkdownHeadingAnchors(section.content.trim(), matterAnchorId(section.key))}\n`).join("\n");
  const backMarkdown = back.map((section) => `<a id="${matterAnchorId(section.key)}"></a>\n## ${section.title}\n\n${addMarkdownHeadingAnchors(section.content.trim(), matterAnchorId(section.key))}\n`).join("\n");
  return [frontMatter, tocEntriesMarkdown(book, chapters), frontMarkdown, chaptersMarkdown, backMarkdown]
    .filter(Boolean)
    .join("\n");
}

function bookHtml(book: Book, chapters: Chapter[]) {
  const title = escapeHtml(book.title || "Untitled manuscript");
  const layout = layoutForBook(book);
  const orderedChapters = orderBookChapters(chapters);
  const subtitle = book.subtitle ? `<p class="subtitle">${escapeHtml(book.subtitle)}</p>` : "";
  const author = book.author ? `<p class="author">${escapeHtml(book.author)}</p>` : "";
  const titlePageChapter = orderedChapters.find((chapter) => chapter.chapter_kind === "title_page");
  const contentChapters = orderedChapters.filter((chapter) => chapter.chapter_kind !== "title_page");
  const titlePageHtml = titlePageChapter
     ? `<section id="${sectionAnchorId(titlePageChapter.id)}" class="title-page">${bookChromeHtml(book, layout, layoutSectionKey("opening", titlePageChapter.id), titlePageChapter.title || "Title page", "opening", 0)}<h1 class="book-title">${escapeHtml(titlePageChapter.title || book.title || "Untitled manuscript")}</h1>${markdownToHtml(titlePageChapter.content, sectionAnchorId(titlePageChapter.id), layout.typography)}</section>`
    : `<section class="title-page">${bookChromeHtml(book, layout, layoutSectionKey("opening"), "Title page", "opening", 0)}<h1 class="book-title">${title}</h1>${subtitle}${author}</section>`;
  const frontMatterHtml = frontMatterSections(book, chapters).map((section, index) => `
    <section id="${matterAnchorId(section.key)}" class="book-matter page-break">
       ${bookChromeHtml(book, layout, "opening", section.title, "opening", index)}
        <h2 class="book-heading-1">${escapeHtml(section.title)}</h2>
        ${markdownToHtml(section.content, matterAnchorId(section.key), layout.typography)}
     </section>`).join("\n");
  const backMatterHtml = backMatterSections(book, chapters).map((section, index) => `
    <section id="${matterAnchorId(section.key)}" class="book-matter page-break">
       ${bookChromeHtml(book, layout, "closing", section.title, "closing", index)}
        <h2 class="book-heading-1">${escapeHtml(section.title)}</h2>
        ${markdownToHtml(section.content, matterAnchorId(section.key), layout.typography)}
     </section>`).join("\n");
  const chaptersHtml = contentChapters.map((chapter, index) => {
    const orderedIndex = orderedChapters.indexOf(chapter);
    const band = chapterPageBand(chapter);
    const label = chapterTitleHeading(chapter, orderedIndex, orderedChapters);
    const showKicker = band === "story" && chapterHasDistinctTitle(chapter, orderedIndex, orderedChapters);
    return `
     <section id="${sectionAnchorId(chapter.id)}" class="${band === "story" ? "chapter" : "book-matter"} ${index ? "page-break" : ""}">
        ${bookChromeHtml(book, layout, layoutSectionKey(band, chapter.id), label, band, chapterBandOrdinal(orderedChapters, orderedIndex))}
        ${showKicker ? `<p class="chapter-kicker">${chapterDisplayLabel(chapter, orderedIndex, orderedChapters)}</p>` : ""}
        <h2 class="book-heading-1">${escapeHtml(label)}</h2>
         ${markdownToHtml(chapter.content, sectionAnchorId(chapter.id), layout.typography)}
      </section>`;
  }).join("\n");
  const contentsHtml = tocEntriesHtml(book, chapters);
  const contentsWithChrome = contentsHtml ? `${bookChromeHtml(book, layout, "contents", tocTitle(book), "contents", 0)}${contentsHtml}` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { size: ${trimCssSize(book.trim_size)}; margin: ${book.margin}in; }
* { box-sizing: border-box; }
 body { margin: 0; color: #24211e; background: #fff; font-family: ${fontCss(book.font_family)}; font-size: ${book.font_size}pt; line-height: ${book.line_height}; } ${typographyCss(layout)}${imagePresentationCss()}
.title-page { min-height: 70vh; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }
h1 { margin: 0; font-size: 2.6em; line-height: 1.05; } .subtitle { margin: 1.3em 0 0; font-size: 1.15em; } .author { margin-top: 5em; font-size: .9em; text-transform: uppercase; letter-spacing: .16em; }
 .chapter, .book-matter { max-width: 100%; } .page-break { page-break-before: always; } .chapter-kicker { color: #8b6a43; font-size: .7em; letter-spacing: .18em; text-transform: uppercase; } h2 { margin: .45em 0 1.6em; font-size: 1.8em; } p { margin: 0 0 ${book.paragraph_spacing}em; text-align: justify; } img { display: block; max-width: 100%; height: auto; margin: 1.4em auto; } blockquote { margin: 1.4em 2em; font-style: italic; } .scene-break { margin: 1.8em 0; text-align: center; letter-spacing: .6em; } .book-toc { page-break-after: always; } .book-toc li { margin: .35em 0; margin-left: calc(var(--toc-indent) * 1.2em); list-style: none; } .book-chrome { margin: 0 0 2em; font-size: .68em; letter-spacing: .08em; text-transform: uppercase; } .book-chrome-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1em; min-height: 1.4em; } .book-chrome-row span:nth-child(2) { text-align: center; } .book-chrome-row span:last-child { text-align: right; } .book-chrome-row.footer { margin-top: .7em; color: #6f6259; }
</style></head><body>
${titlePageHtml}
 ${contentsWithChrome}
${frontMatterHtml}
${chaptersHtml}
${backMatterHtml}
</body></html>`;
}

function bookText(book: Book, chapters: Chapter[]) {
  const orderedChapters = orderBookChapters(chapters);
  return [
    book.title,
    book.subtitle,
    book.author,
    "",
    ...tocEntriesText(book, chapters),
    ...frontMatterSections(book, chapters).flatMap((section) => [section.title, "", plainTextContent(section.content), ""]),
    ...orderedChapters.flatMap((chapter, index) => [chapterHeading(chapter, index, orderedChapters), "", plainTextContent(chapter.content), ""]),
    ...backMatterSections(book, chapters).flatMap((section) => [section.title, "", plainTextContent(section.content), ""]),
  ].filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

function docxXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function docxPageMarker(layout: BookLayout) {
  return layout.pageNumbering.style === "custom"
    ? (layout.pageNumbering.customFormat.replace(/\{n\}/g, "{{page}}") || "{{page}}")
    : "{{page}}";
}

function docxRuns(value: string, layout: BookLayout) {
  return value.split(/(\{\{page\}\})/gi).map((part) => {
    if (part.toLocaleLowerCase() === "{{page}}") {
      const switchValue = layout.pageNumbering.style === "roman-lower" ? "PAGE \\* roman" : layout.pageNumbering.style === "roman-upper" ? "PAGE \\* ROMAN" : "PAGE";
      return `<w:fldSimple w:instr="${switchValue}"><w:r><w:t>1</w:t></w:r></w:fldSimple>`;
    }
    return part ? `<w:r><w:t xml:space="preserve">${docxXml(part)}</w:t></w:r>` : "";
  }).join("");
}

function docxStyledRuns(value: string, style: BookTextStyle, layout: BookLayout) {
  const tokens = value.split(/(\s+)/);
  let wordIndex = 0;
  let dropCapUsed = false;
  const nestedProperties = style.nestedStyle === "none" ? "" : `<w:rPr><w:rFonts w:ascii="${docxXml(docxFontFamily({ ...style, fontFamily: style.nestedFontFamily }))}" w:hAnsi="${docxXml(docxFontFamily({ ...style, fontFamily: style.nestedFontFamily }))}"/>${style.nestedStyle === "small-caps" ? "<w:smallCaps/>" : style.nestedStyle === "bold" ? "<w:b/>" : style.nestedStyle === "italic" ? "<w:i/>" : ""}${style.nestedStyle === "accent" ? `<w:color w:val="${style.nestedColor.slice(1).toUpperCase()}"/>` : ""}</w:rPr>`;
  return tokens.map((token) => {
    if (!token) return "";
    if (/\s+/.test(token)) return docxRuns(token, layout);
    const nested = style.nestedStyle !== "none" && wordIndex < style.nestedWords;
    wordIndex += 1;
    if (style.dropCap && !dropCapUsed) {
      dropCapUsed = true;
      const first = token.slice(0, 1);
      const rest = token.slice(1);
      const dropCapProperties = `<w:rPr><w:rFonts w:ascii="${docxXml(docxFontFamily({ ...style, fontFamily: style.dropCapFontFamily }))}" w:hAnsi="${docxXml(docxFontFamily({ ...style, fontFamily: style.dropCapFontFamily }))}"/><w:sz w:val="${Math.round(style.fontSize * style.dropCapLines * 0.82 * 2)}"/><w:color w:val="${style.dropCapColor.slice(1).toUpperCase()}"/></w:rPr>`;
      return `${docxRunsWithProperties(first, layout, dropCapProperties)}${rest ? docxRunsWithProperties(rest, layout, nested ? nestedProperties : "") : ""}`;
    }
    return docxRunsWithProperties(token, layout, nested ? nestedProperties : "");
  }).join("");
}

function docxRunsWithProperties(value: string, layout: BookLayout, properties: string) {
  return value.split(/(\{\{page\}\})/gi).map((part) => {
    if (part.toLocaleLowerCase() === "{{page}}") {
      const switchValue = layout.pageNumbering.style === "roman-lower" ? "PAGE \\* roman" : layout.pageNumbering.style === "roman-upper" ? "PAGE \\* ROMAN" : "PAGE";
      return `<w:fldSimple w:instr="${switchValue}"><w:r>${properties}<w:t>1</w:t></w:r></w:fldSimple>`;
    }
    return part ? `<w:r>${properties}<w:t xml:space="preserve">${docxXml(part)}</w:t></w:r>` : "";
  }).join("");
}

function docxFontFamily(style: BookTextStyle) {
  return (fontCss(style.fontFamily).split(",")[0] ?? "Georgia").trim().replace(/^['"]|['"]$/g, "") || "Georgia";
}

function docxStyleXml(styleId: string, name: string, style: BookTextStyle, afterTwips = 0, basedOn?: string) {
  const alignment = style.textAlign === "justify" ? "both" : style.textAlign;
  const font = docxXml(docxFontFamily(style));
  const fontSize = Math.max(12, Math.round(style.fontSize * 2));
  const lineHeight = Math.max(120, Math.round(style.lineHeight * 240));
  const letterSpacing = Math.round(style.letterSpacing * style.fontSize * 20);
  const before = Math.round(style.spaceBefore * style.fontSize * 20);
  const after = style.spaceAfter > 0 ? Math.round(style.spaceAfter * style.fontSize * 20) : afterTwips;
  const firstLine = Math.round(style.firstLineIndent * style.fontSize * 20);
  const left = Math.round(style.leftIndent * style.fontSize * 20);
  const right = Math.round(style.rightIndent * style.fontSize * 20);
  const indent = firstLine || left || right ? `<w:ind${firstLine ? ` w:firstLine="${firstLine}"` : ""}${left ? ` w:left="${left}"` : ""}${right ? ` w:right="${right}"` : ""}/>` : "";
  return `<w:style w:type="paragraph" w:styleId="${styleId}"><w:name w:val="${name}"/>${basedOn ? `<w:basedOn w:val="${basedOn}"/>` : ""}<w:pPr><w:jc w:val="${alignment}"/><w:spacing w:line="${lineHeight}" w:lineRule="auto"${before ? ` w:before="${before}"` : ""}${after ? ` w:after="${after}"` : ""}/>${indent}</w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>${style.fontWeight >= 600 ? "<w:b/>" : ""}${style.fontStyle === "italic" ? "<w:i/>" : ""}${letterSpacing ? `<w:spacing w:val="${letterSpacing}"/>` : ""}</w:rPr></w:style>`;
}

function docxTextParagraph(line: string, layout: BookLayout) {
  const trimmed = canvasLayoutFromSource(line).clean.trim();
  const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  const quote = /^>\s?(.+)$/.exec(trimmed);
  const role = heading ? `heading${Math.min(6, heading[1].length)}` as BookTextRole : quote ? "quote" : "paragraph";
  const styleId = role === "paragraph" ? "Normal" : role === "quote" ? "Quote" : `Heading${role.replace("heading", "")}`;
  const text = heading?.[2] ?? quote?.[1] ?? trimmed;
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${docxStyledRuns(text, layout.typography[role], layout)}</w:p>`;
}

function docxChromeXml(book: Book, layout: BookLayout, kind: "header" | "footer") {
  const pageMarker = docxPageMarker(layout);
  const chrome = kind === "header" ? layout.header : layout.footer;
  const values = [chrome.left, chrome.center, chrome.right].map((value) => layoutTokenText(value, book, "", layout.pageNumbering.enabled ? pageMarker : ""));
  if (kind === "footer" && layout.pageNumbering.enabled && !layout.footer[layout.pageNumbering.placement].includes("{{page}}")) {
    const placementIndex = layout.pageNumbering.placement === "left" ? 0 : layout.pageNumbering.placement === "center" ? 1 : 2;
    values[placementIndex] = [values[placementIndex], pageMarker].filter(Boolean).join(" · ");
  }
  if (!values.some(Boolean)) return `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`;
  const alignments = ["left", "center", "right"];
  const cells = values.map((value, index) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="${alignments[index]}"/></w:pPr>${docxRuns(value, layout)}</w:p></w:tc>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tr>${cells}</w:tr></w:tbl>`;
}

interface DocxAssetState {
  imageCount: number;
  media: Record<string, Uint8Array>;
  relationships: string[];
}

function docxDrawingParagraph(label: string, bytes: Uint8Array, extension: string, assets: DocxAssetState, width = 4572000, height = 3000000) {
  assets.imageCount += 1;
  const mediaPath = `word/media/image${assets.imageCount}.${extension}`;
  const relationshipId = `rId${assets.imageCount + 3}`;
  assets.media[mediaPath] = bytes;
  assets.relationships.push(`<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${assets.imageCount}.${extension}"/>`);
  const safeLabel = docxXml(label || `Image ${assets.imageCount}`);
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${assets.imageCount}" name="${safeLabel}" descr="${safeLabel}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${assets.imageCount}" name="${safeLabel}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function docxImageParagraph(line: string, assets: DocxAssetState) {
  const match = /^!\[([^\]]*)\]\(data:(image\/(?:png|jpeg|jpg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)\)(?:\{[^}]*\})?$/.exec(line.trim());
  if (!match) return null;
  if (match[2] === "image/webp") return `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>${docxXml(match[1] || "Embedded image")}</w:t></w:r></w:p>`;
  try {
    const bytes = Uint8Array.from(atob(match[3]), (value) => value.charCodeAt(0));
    const extension = match[2] === "image/jpeg" || match[2] === "image/jpg" ? "jpg" : match[2] === "image/svg+xml" ? "svg" : match[2] === "image/gif" ? "gif" : "png";
    return docxDrawingParagraph(match[1] || "Embedded image", bytes, extension, assets);
  } catch {
    return `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>${docxXml(match[1] || "Embedded image")}</w:t></w:r></w:p>`;
  }
}

function docxTableXml(lines: string[], options: TableData, layout: BookLayout) {
  if (lines.length < 2 || !tableSeparator(lines[1])) return docxTextParagraph(lines.join(" "), layout);
  const headers = splitTableCells(lines[0]);
  const alignments = tableAlignments(lines[1]);
  const rows = lines.slice(2).filter(tableRow).map(splitTableCells);
  const cell = (value: string, index: number, header = false, rowIndex = 0) => `<w:tc><w:tcPr><w:shd w:fill="${header ? "E9DED0" : options.striped && rowIndex % 2 === 1 ? "F4EEE7" : "FBF8F3"}"/>${options.compact ? "<w:tcMar><w:top w:w=\"60\" w:type=\"dxa\"/><w:bottom w:w=\"60\" w:type=\"dxa\"/></w:tcMar>" : ""}<w:tcW w:w="1800" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="${alignments[index] ?? "left"}"/></w:pPr><w:r>${header ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${docxXml(value)}</w:t></w:r></w:p></w:tc>`;
  const row = (values: string[], header = false, rowIndex = 0) => `<w:tr>${headers.map((_header, index) => cell(values[index] ?? "", index, header, rowIndex)).join("")}</w:tr>`;
  const caption = options.caption ? `<w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>${docxXml(options.caption)}</w:t></w:r></w:p>` : "";
  return `${caption}<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:jc w:val="${options.align}"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="C8B8A8"/><w:left w:val="single" w:sz="4" w:color="C8B8A8"/><w:bottom w:val="single" w:sz="4" w:color="C8B8A8"/><w:right w:val="single" w:sz="4" w:color="C8B8A8"/><w:insideH w:val="single" w:sz="4" w:color="D9CEC2"/><w:insideV w:val="single" w:sz="4" w:color="D9CEC2"/></w:tblBorders></w:tblPr>${row(headers, true)}${rows.map((values, index) => row(values, false, index)).join("")}</w:tbl>`;
}

function docxChartParagraph(data: ChartData, assets: DocxAssetState) {
  const svg = renderChart(data).match(/<svg[\s\S]*<\/svg>/)?.[0]?.replace(/var\(--book-paper,\s*#fffaf3\)/g, "#fffaf3");
  if (!svg) return null;
  return docxDrawingParagraph(data.title || `${data.type} chart`, new TextEncoder().encode(svg), "svg", assets, 6000000, data.type === "stat" ? 2500000 : 3200000);
}

function docxCalloutParagraph(body: string, layout: BookLayout) {
  const parsed = richJsonLine(body);
  const options = objectValue(parsed.value) ? parsed.value : {};
  const title = typeof options.title === "string" ? options.title : "Note";
  const content = body.split(/\r?\n/).filter((_line, index) => index !== parsed.index).join(" ").trim();
  return `<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${docxXml(`${title}: `)}</w:t></w:r>${docxRuns(content, layout)}</w:p>`;
}

function docxContentParagraphs(content: string, assets: DocxAssetState, layout: BookLayout) {
  const lines = content.split(/\r?\n/);
  const paragraphs: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const directive = /^:::\s*(table|chart|callout)\s*$/i.exec(trimmed);
    const chartFence = /^```(?:chart|graph)\s*$/i.test(trimmed);
    if (directive || chartFence) {
      const closing = directive ? ":::" : "```";
      const closingIndex = lines.findIndex((_candidate, candidateIndex) => candidateIndex > index && lines[candidateIndex].trim() === closing);
      if (closingIndex !== -1) {
        const body = lines.slice(index + 1, closingIndex).join("\n");
        const kind = (directive?.[1].toLocaleLowerCase() ?? "chart") as RichBlockKind;
        if (kind === "chart") {
          const chart = chartDataFromJson(body);
          paragraphs.push(chart ? (docxChartParagraph(chart, assets) ?? docxTextParagraph(body, layout)) : docxTextParagraph(body, layout));
        } else if (kind === "callout") {
          paragraphs.push(docxCalloutParagraph(body, layout));
        } else {
          const table = tableContentFromBody(body);
          paragraphs.push(docxTableXml(table.lines, table.options, layout));
        }
        index = closingIndex;
        continue;
      }
    }
    if (tableRow(line) && tableSeparator(lines[index + 1] ?? "")) {
      const tableLines = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && tableRow(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      paragraphs.push(docxTableXml(tableLines, tableDataFromValue(null), layout));
      continue;
    }
    if (!trimmed) continue;
    paragraphs.push(docxImageParagraph(line, assets) ?? docxTextParagraph(line, layout));
  }
  return paragraphs;
}

async function bookDocx(book: Book, chapters: Chapter[]) {
  const { zipSync, strToU8 } = await import("fflate");
  const layout = layoutForBook(book);
  const orderedChapters = orderBookChapters(chapters);
  const assets: DocxAssetState = { imageCount: 0, media: {}, relationships: [] };
  const pageSizes: Record<string, { width: number; height: number }> = {
    "5x8": { width: 7200, height: 11520 },
    "5.25x8": { width: 7560, height: 11520 },
    "6x9": { width: 8640, height: 12960 },
    "5.83x8.27": { width: 8395, height: 11909 },
    "8.27x11.69": { width: 11909, height: 16834 },
    "8.5x11": { width: 12240, height: 15840 },
  };
  const pageSize = pageSizes[book.trim_size] ?? pageSizes["6x9"];
  const toc = buildBookToc(book, chapters);
  const paragraphAfter = Math.max(0, Math.round(layout.typography.paragraph.fontSize * book.paragraph_spacing * 20));
  const tocParagraphs = toc.length ? [
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:pageBreakBefore/></w:pPr><w:r><w:t>${docxXml(tocTitle(book))}</w:t></w:r></w:p>`,
    ...toc.map((entry) => `<w:p><w:pPr><w:ind w:left="${Math.max(0, entry.level - 1) * 360}"/></w:pPr><w:r><w:t>${docxXml(entry.label)}</w:t></w:r></w:p>`),
  ] : [];
  const titlePageChapter = orderedChapters.find((chapter) => chapter.chapter_kind === "title_page");
  const titleParagraphs = titlePageChapter
    ? [
        `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${docxXml(titlePageChapter.title || book.title)}</w:t></w:r></w:p>`,
          ...docxContentParagraphs(titlePageChapter.content, assets, layout),
      ]
    : [
        `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${docxXml(book.title)}</w:t></w:r></w:p>`,
        ...(book.subtitle ? [`<w:p><w:r><w:t>${docxXml(book.subtitle)}</w:t></w:r></w:p>`] : []),
        ...(book.author ? [`<w:p><w:r><w:t>${docxXml(book.author)}</w:t></w:r></w:p>`] : []),
      ];
  const paragraphs = [
    ...titleParagraphs,
    ...tocParagraphs,
    ...frontMatterSections(book, chapters).flatMap((section) => [
      `<w:p><w:pPr><w:pageBreakBefore/><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${docxXml(section.title)}</w:t></w:r></w:p>`,
        ...docxContentParagraphs(section.content, assets, layout),
    ]),
     ...orderedChapters.filter((chapter) => chapter.chapter_kind !== "title_page").flatMap((chapter) => [
       (() => {
         const index = orderedChapters.indexOf(chapter);
         const pageBreak = "<w:pageBreakBefore/>";
         return `<w:p><w:pPr>${pageBreak}<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${docxXml(chapterHeading(chapter, index, orderedChapters))}</w:t></w:r></w:p>`;
       })(),
         ...docxContentParagraphs(chapter.content, assets, layout),
    ]),
    ...backMatterSections(book, chapters).flatMap((section) => [
      `<w:p><w:pPr><w:pageBreakBefore/><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${docxXml(section.title)}</w:t></w:r></w:p>`,
         ...docxContentParagraphs(section.content, assets, layout),
    ]),
  ].join("");
  const pageFormat = layout.pageNumbering.style === "roman-lower" ? "lowerRoman" : layout.pageNumbering.style === "roman-upper" ? "upperRoman" : "decimal";
  const pageNumberType = layout.pageNumbering.enabled ? `<w:pgNumType w:fmt="${pageFormat}" w:start="${layout.pageNumbering.start}"/>` : "";
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${paragraphs}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="${pageSize.width}" w:h="${pageSize.height}"/><w:pgMar w:top="${Math.round(book.margin * 1440)}" w:right="${Math.round(book.margin * 1440)}" w:bottom="${Math.round(book.margin * 1440)}" w:left="${Math.round(book.margin * 1440)}"/>${pageNumberType}</w:sectPr></w:body></w:document>`;
  const captionStyle: BookTextStyle = { ...layout.typography.heading3, fontSize: Math.max(8, layout.typography.heading3.fontSize - 2), fontWeight: 400, fontStyle: "italic", textAlign: "left" };
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${docxStyleXml("NormalDefaults", "Normal defaults", layout.typography.paragraph).match(/<w:rPr>([\s\S]*)<\/w:rPr>/)?.[1] ?? ""}</w:rPr></w:rPrDefault></w:docDefaults>${docxStyleXml("Normal", "Normal", layout.typography.paragraph, paragraphAfter)}${docxStyleXml("Title", "Title", layout.typography.title, paragraphAfter, "Normal")}${([1, 2, 3, 4, 5, 6] as const).map((level) => docxStyleXml(`Heading${level}`, `heading ${level}`, layout.typography[`heading${level}`], paragraphAfter, "Normal")).join("")}${docxStyleXml("Quote", "Quote", layout.typography.quote, paragraphAfter, "Normal")}${docxStyleXml("Caption", "Caption", captionStyle, 40, "Normal")}</w:styles>`;
  return zipSync({
     "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${assets.relationships.join("")}</Relationships>`),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/header1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${docxChromeXml(book, layout, "header")}</w:hdr>`),
    "word/footer1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${docxChromeXml(book, layout, "footer")}</w:ftr>`),
    ...assets.media,
  });
}

async function bookEpub(book: Book, chapters: Chapter[]) {
  const { zipSync, strToU8 } = await import("fflate");
  const bookId = `noteme-book-${book.id}`;
  const layout = layoutForBook(book);
  const orderedChapters = orderBookChapters(chapters);
  const chapterFiles: Record<string, Uint8Array> = {};
  const epubImages = new Map<string, string>();
  const manifest: string[] = [];
  const spine: string[] = [];
  const epubCss = `body{font-family:${fontCss(book.font_family)};font-size:${book.font_size}pt;line-height:${book.line_height};margin:${book.margin}in}${typographyCss(layout)}${imagePresentationCss()}h1{font-size:1.8em}h2{font-size:1.4em}p{margin-bottom:${book.paragraph_spacing}em}img{display:block;max-width:100%;height:auto;margin:1.4em auto}.title-page{text-align:center;margin-top:30vh}.matter{text-align:left}.book-toc li{margin:.35em 0;margin-left:calc(var(--toc-indent) * 1.2em);list-style:none}.book-chrome{margin:0 0 2em;font-size:.68em;letter-spacing:.08em;text-transform:uppercase}.book-chrome-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1em;min-height:1.4em}.book-chrome-row span:nth-child(2){text-align:center}.book-chrome-row span:last-child{text-align:right}.book-chrome-row.footer{margin-top:.7em;color:#6f6259}`;
  const embedImages = (body: string) => body.replace(/src="(data:(image\/(?:png|jpeg|jpg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=]+))"/gi, (_match, dataUri: string, mime: string, encoded: string) => {
    const existingPath = epubImages.get(dataUri);
    if (existingPath) return `src="${existingPath}"`;
    const extension = mime === "image/jpeg" || mime === "image/jpg" ? "jpg" : mime === "image/svg+xml" ? "svg" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : "png";
    const imageNumber = epubImages.size + 1;
    const imagePath = `images/image${imageNumber}.${extension}`;
    epubImages.set(dataUri, imagePath);
    chapterFiles[`OEBPS/${imagePath}`] = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0));
    manifest.push(`<item id="image-${imageNumber}" href="${imagePath}" media-type="${mime}"/>`);
    return `src="${imagePath}"`;
  });
  const addSection = (id: string, title: string, body: string) => {
    const file = `OEBPS/${id}.xhtml`;
    manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
    chapterFiles[file] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHtml(title)}</title><style>${epubCss}</style></head><body>${embedImages(body)}</body></html>`);
  };
  const titlePageChapter = orderedChapters.find((chapter) => chapter.chapter_kind === "title_page");
  if (titlePageChapter) {
     addSection("title-page", titlePageChapter.title || book.title || "Untitled manuscript", `<section id="${sectionAnchorId(titlePageChapter.id)}" class="title-page">${bookChromeHtml(book, layout, layoutSectionKey("opening", titlePageChapter.id), titlePageChapter.title || "Title page", "opening", 0)}<h1 class="book-title">${escapeHtml(titlePageChapter.title || book.title || "Untitled manuscript")}</h1>${markdownToHtml(titlePageChapter.content, sectionAnchorId(titlePageChapter.id), layout.typography)}</section>`);
  } else {
    addSection("title-page", book.title || "Untitled manuscript", `<section class="title-page">${bookChromeHtml(book, layout, layoutSectionKey("opening"), "Title page", "opening", 0)}<h1 class="book-title">${escapeHtml(book.title || "Untitled manuscript")}</h1>${book.subtitle ? `<p class="book-paragraph">${escapeHtml(book.subtitle)}</p>` : ""}${book.author ? `<p class="book-paragraph">${escapeHtml(book.author)}</p>` : ""}</section>`);
  }
  const front = frontMatterSections(book, chapters);
   if (front.length) addSection("front-matter", "Front matter", `<section class="matter">${front.map((section, index) => `<section id="${matterAnchorId(section.key)}">${bookChromeHtml(book, layout, "opening", section.title, "opening", index)}<h1 class="book-heading-1">${escapeHtml(section.title)}</h1>${markdownToHtml(section.content, matterAnchorId(section.key), layout.typography)}</section>`).join("")}</section>`);
  orderedChapters.filter((chapter) => chapter.chapter_kind !== "title_page").forEach((chapter) => {
    const index = orderedChapters.indexOf(chapter);
    const id = `chapter-${chapter.id}`;
    const band = chapterPageBand(chapter);
    const label = chapterTitleHeading(chapter, index, orderedChapters);
    const showKicker = band === "story" && chapterHasDistinctTitle(chapter, index, orderedChapters);
     addSection(id, label, `<section id="${sectionAnchorId(chapter.id)}">${bookChromeHtml(book, layout, layoutSectionKey(band, chapter.id), label, band, chapterBandOrdinal(orderedChapters, index))}${showKicker ? `<p>${escapeHtml(chapterDisplayLabel(chapter, index, orderedChapters))}</p>` : ""}<h1>${escapeHtml(label)}</h1>${markdownToHtml(chapter.content, sectionAnchorId(chapter.id), layout.typography)}</section>`);
  });
  const back = backMatterSections(book, chapters);
   if (back.length) addSection("back-matter", "Back matter", `<section class="matter">${back.map((section, index) => `<section id="${matterAnchorId(section.key)}">${bookChromeHtml(book, layout, "closing", section.title, "closing", index)}<h1 class="book-heading-1">${escapeHtml(section.title)}</h1>${markdownToHtml(section.content, matterAnchorId(section.key), layout.typography)}</section>`).join("")}</section>`);
  const toc = buildBookToc(book, chapters);
  const tocHref = (entry: TocEntry) => {
    if (entry.chapterId === titlePageChapter?.id) return `title-page.xhtml#${entry.id}`;
    if (entry.chapterId !== undefined) return `chapter-${entry.chapterId}.xhtml#${entry.id}`;
    return `${entry.matterKey && front.some((section) => section.key === entry.matterKey) ? "front-matter" : "back-matter"}.xhtml#${entry.id}`;
  };
  const navItems = toc.map((entry) => `<li style="--toc-indent: ${Math.max(0, entry.level - 1)}"><a href="${tocHref(entry)}">${escapeHtml(entry.label)}</a></li>`).join("");
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${bookId}</dc:identifier><dc:title>${escapeHtml(book.title || "Untitled manuscript")}</dc:title><dc:creator>${escapeHtml(book.author || "Unknown author")}</dc:creator><dc:language>en</dc:language>${book.genre ? `<dc:subject>${escapeHtml(book.genre)}</dc:subject>` : ""}${book.description ? `<dc:description>${escapeHtml(book.description)}</dc:description>` : ""}<meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" properties="nav" href="nav.xhtml" media-type="application/xhtml+xml"/>${manifest.join("")}</manifest><spine>${spine.join("")}</spine></package>`;
  const nav = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeHtml(book.title)}</title></head><body><nav epub:type="toc"><h1>${escapeHtml(tocTitle(book))}</h1><ol>${navItems}</ol></nav></body></html>`;
  return zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
    ...chapterFiles,
  });
}

function filenameFor(book: Book, extension: string) {
  const title = (book.title || "untitled-manuscript").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${title || "untitled-manuscript"}${extension}`;
}

async function exportBook(book: Book, chapters: Chapter[], format: ExportFormat) {
  const [{ save }, { writeFile, writeTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const option = EXPORT_OPTIONS.find((item) => item.value === format)!;
  const path = await save({
    defaultPath: filenameFor(book, option.extension),
    filters: [{ name: option.label, extensions: [option.extension.slice(1)] }],
  });
  if (!path) return;
  if (format === "markdown") await writeTextFile(path, bookMarkdown(book, chapters));
  if (format === "html") await writeTextFile(path, bookHtml(book, chapters));
  if (format === "txt") await writeTextFile(path, bookText(book, chapters));
  if (format === "epub") await writeFile(path, await bookEpub(book, chapters));
  if (format === "docx") await writeFile(path, await bookDocx(book, chapters));
  notify("success", "Book exported", path);
}

export function manuscriptStyle(book: Book): CSSProperties {
  const typography = layoutForBook(book).typography;
  const typographyVars = Object.fromEntries(Object.entries(typography).flatMap(([role, style]) => [
    [`--book-${role}-font`, fontCss(style.fontFamily)],
    [`--book-${role}-size`, `${style.fontSize}pt`],
    [`--book-${role}-weight`, style.fontWeight],
    [`--book-${role}-style`, style.fontStyle],
    [`--book-${role}-align`, style.textAlign],
    [`--book-${role}-line-height`, style.lineHeight],
    [`--book-${role}-letter-spacing`, `${style.letterSpacing}em`],
    [`--book-${role}-first-line-indent`, `${style.firstLineIndent}em`],
    [`--book-${role}-left-indent`, `${style.leftIndent}em`],
    [`--book-${role}-right-indent`, `${style.rightIndent}em`],
    [`--book-${role}-space-before`, `${style.spaceBefore}em`],
    [`--book-${role}-space-after`, `${style.spaceAfter}em`],
    [`--book-${role}-drop-cap-lines`, style.dropCapLines],
    [`--book-${role}-drop-cap-size`, `${style.fontSize * style.dropCapLines * 0.82}pt`],
    [`--book-${role}-drop-cap-gap`, `${style.dropCapGap}em`],
    [`--book-${role}-drop-cap-font`, fontCss(style.dropCapFontFamily)],
    [`--book-${role}-drop-cap-color`, style.dropCapColor],
    [`--book-${role}-nested-words`, style.nestedWords],
    [`--book-${role}-nested-font`, fontCss(style.nestedFontFamily)],
    [`--book-${role}-nested-color`, style.nestedColor],
  ]));
  return {
    "--book-accent": book.cover_color || "#a56b3e",
    "--book-font": fontCss(book.font_family),
    "--book-font-size": `${book.font_size}pt`,
    "--book-line-height": book.line_height,
    "--book-paragraph-spacing": `${book.paragraph_spacing}em`,
    "--book-margin": `${book.margin}in`,
    ...typographyVars,
  } as CSSProperties;
}

function typographyCss(layout: BookLayout) {
  const styleCss = (role: keyof BookLayout["typography"]) => {
    const style = layout.typography[role];
    return `font-family:${fontCss(style.fontFamily)};font-size:${style.fontSize}pt;font-weight:${style.fontWeight};font-style:${style.fontStyle};text-align:${style.textAlign};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing}em`;
  };
  const paragraph = layout.typography.paragraph;
  const paragraphExtras = `text-indent:${paragraph.firstLineIndent}em;padding-left:${paragraph.leftIndent}em;padding-right:${paragraph.rightIndent}em;margin-top:${paragraph.spaceBefore}em;margin-bottom:${paragraph.spaceAfter}em`;
  const dropCap = paragraph.dropCap ? `.book-paragraph.has-drop-cap::first-letter{float:left;font-family:${fontCss(paragraph.dropCapFontFamily)};font-size:${paragraph.fontSize * paragraph.dropCapLines * 0.82}pt;line-height:.78;color:${paragraph.dropCapColor};padding-right:${paragraph.dropCapGap}em;margin-top:.06em;font-weight:${Math.max(400, paragraph.fontWeight)}}` : "";
  const nested = `.book-nested-style{font-family:${fontCss(paragraph.nestedFontFamily)};color:${paragraph.nestedColor}}.book-nested-style.nested-small-caps{font-variant:small-caps;letter-spacing:.06em;text-transform:uppercase}.book-nested-style.nested-bold{font-weight:700}.book-nested-style.nested-italic{font-style:italic}.book-nested-style.nested-accent{color:${paragraph.nestedColor}}`;
  return `.book-title{${styleCss("title")}}.book-paragraph{${styleCss("paragraph")};${paragraphExtras}}.book-quote{${styleCss("quote")}}${([1, 2, 3, 4, 5, 6] as const).map((level) => `.book-heading-${level}{${styleCss(`heading${level}`)}}`).join("")}${dropCap}${nested}`;
}

function imagePresentationCss() {
  return ".book-image.radius-soft{border-radius:7px}.book-image.radius-round{border-radius:18px}.book-image.align-left{margin-left:0;margin-right:auto}.book-image.align-center{margin-left:auto;margin-right:auto}.book-image.align-right{margin-left:auto;margin-right:0}";
}

type PageBand = "opening" | "contents" | "story" | "closing";

function bookChromeValues(book: Book, layout: BookLayout, key: string, section: string, band: PageBand, ordinal: number) {
  const page = pageNumberForSection(layout, key, band, ordinal);
  const resolve = (value: string) => layoutTokenText(value, book, section, page ?? "");
  const header = [layout.header.left, layout.header.center, layout.header.right].map(resolve);
  const footer = [layout.footer.left, layout.footer.center, layout.footer.right].map(resolve);
  if (page && !layout.footer[layout.pageNumbering.placement].includes("{{page}}")) {
    const placementIndex = layout.pageNumbering.placement === "left" ? 0 : layout.pageNumbering.placement === "center" ? 1 : 2;
    footer[placementIndex] = [footer[placementIndex], page].filter(Boolean).join(" · ");
  }
  return { page, header, footer };
}

function bookChromeHtml(book: Book, layout: BookLayout, key: string, section: string, band: PageBand, ordinal: number) {
  const values = bookChromeValues(book, layout, key, section, band, ordinal);
  const row = (name: string, slots: string[]) => slots.some(Boolean) ? `<div class="book-chrome-row ${name}">${slots.map((slot) => `<span>${escapeHtml(slot)}</span>`).join("")}</div>` : "";
  const markup = `${row("header", values.header)}${row("footer", values.footer)}`;
  return markup ? `<div class="book-chrome">${markup}</div>` : "";
}

function BooksPageChrome({ book, keyName, section, band, ordinal }: { book: Book; keyName: string; section: string; band: PageBand; ordinal: number }) {
  const values = bookChromeValues(book, layoutForBook(book), keyName, section, band, ordinal);
  if (!values.header.some(Boolean) && !values.footer.some(Boolean)) return null;
  const row = (name: string, slots: string[]) => slots.some(Boolean) ? <div className={`books-page-chrome-row ${name}`}>{slots.map((slot, index) => <span key={`${name}-${index}`}>{slot}</span>)}</div> : null;
  return <div className="books-page-chrome">{row("header", values.header)}{row("footer", values.footer)}</div>;
}

function ScreenNav({ screen, hasBook, onChange }: { screen: StudioScreen; hasBook: boolean; onChange: (screen: StudioScreen) => void }) {
  const modifier = navigator.userAgent.includes("Macintosh") || navigator.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";
  const items: { id: StudioScreen; label: string; icon: typeof Library; shortcut: string }[] = [
    { id: "library", label: "Library", icon: Library, shortcut: `${modifier}1` },
    { id: "manuscript", label: "Manuscript", icon: NotebookPen, shortcut: `${modifier}2` },
    { id: "outline", label: "Outline", icon: LayoutList, shortcut: `${modifier}3` },
    { id: "settings", label: "Book settings", icon: Settings2, shortcut: `${modifier}4` },
    { id: "export", label: "Export studio", icon: Download, shortcut: `${modifier}5` },
  ];
  return (
    <nav className="books-nav" aria-label="Books Studio">
      <span className="books-nav-label">Workspace</span>
      {items.map(({ id, label, icon: Icon, shortcut }) => {
        const disabled = id !== "library" && !hasBook;
        return (
          <button key={id} className={`books-nav-item ${screen === id ? "active" : ""}`} onClick={() => onChange(id)} title={disabled ? `Choose a manuscript to open ${label.toLocaleLowerCase()}` : `${label} (${shortcut})`} disabled={disabled} aria-current={screen === id ? "page" : undefined}>
            <Icon size={15} /> <span>{label}</span>
            <kbd>{shortcut}</kbd>
            {screen === id && <ChevronRight size={13} className="books-nav-chevron" />}
          </button>
        );
      })}
    </nav>
  );
}

function BooksCommandPalette({ open, bookTitle, chapters, onClose, onNavigate, onNewChapter, onOpenChapter }: { open: boolean; bookTitle?: string; chapters: Chapter[]; onClose: () => void; onNavigate: (screen: StudioScreen) => void; onNewChapter: (kind?: ChapterKind) => void; onOpenChapter: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      requestAnimationFrame(() => {
        if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
      });
    };
  }, [open]);

  const items = useMemo(() => {
    const commands = [
      { id: "library", label: "Open library", sub: "⌘1", icon: <Library size={15} />, action: () => onNavigate("library") },
      ...(bookTitle ? [
        { id: "manuscript", label: "Open manuscript", sub: "⌘2", icon: <NotebookPen size={15} />, action: () => onNavigate("manuscript") },
        { id: "outline", label: "Open outline", sub: "⌘3", icon: <LayoutList size={15} />, action: () => onNavigate("outline") },
        { id: "settings", label: "Open book settings", sub: "⌘4", icon: <Settings2 size={15} />, action: () => onNavigate("settings") },
        { id: "export", label: "Open export studio", sub: "⌘5", icon: <Download size={15} />, action: () => onNavigate("export") },
        { id: "new-chapter", label: "Add chapter", sub: "New section", icon: <Plus size={15} />, action: () => onNewChapter("chapter") },
      ] : []),
      ...chapters.map((chapter) => ({
        id: `section-${chapter.id}`,
        label: chapter.title || "Untitled section",
        sub: chapterKindLabel(chapter.chapter_kind),
        icon: <BookOpen size={15} />,
        action: () => onOpenChapter(chapter.id),
      })),
    ];
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? commands.filter((command) => `${command.label} ${command.sub}`.toLocaleLowerCase().includes(normalized))
      : commands;
    return filtered.length ? filtered : [{ id: "none", label: "No matching commands", sub: "Try a section title or action", icon: <Search size={15} />, action: () => {} }];
  }, [bookTitle, chapters, onNavigate, onNewChapter, onOpenChapter, query]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index, items.length]);

  if (!open) return null;

  const run = (item: (typeof items)[number]) => {
    if (item.id === "none") return;
    item.action();
    onClose();
  };

  return (
    <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ alignItems: "flex-start", paddingTop: "10vh" }}>
      <div className="palette books-command-palette" role="dialog" aria-modal="true" aria-label="Books Studio command palette">
        <div className="palette-input">
          <Search size={16} color="var(--book-accent)" />
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); }} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowDown") { event.preventDefault(); setIndex((value) => Math.min(value + 1, items.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setIndex((value) => Math.max(value - 1, 0)); } if (event.key === "Enter" && items[index]) { event.preventDefault(); run(items[index]); } }} placeholder="Search sections or commands…" aria-label="Search sections or commands" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={`books-command-${items[index]?.id ?? "none"}`} />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} id={listId} role="listbox" aria-label="Books Studio commands">
          {items.map((item, itemIndex) => <button key={item.id} id={`books-command-${item.id}`} role="option" aria-selected={itemIndex === index} aria-disabled={item.id === "none"} disabled={item.id === "none"} className={`palette-item ${itemIndex === index ? "active" : ""}`} onMouseEnter={() => setIndex(itemIndex)} onClick={() => run(item)}><span className="books-command-icon">{item.icon}</span><span className="palette-label">{item.label}</span>{item.sub && <span className="palette-sub">{item.sub}</span>}</button>)}
        </div>
      </div>
    </div>
  );
}

function LibraryScreen({ books, creating, deletingBookId, onNew, onOpen, onDelete }: { books: Book[]; creating: boolean; deletingBookId: number | null; onNew: () => void; onOpen: (id: number) => void; onDelete: (book: Book) => void }) {
  const [menuBookId, setMenuBookId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = (restoreFocus = false) => {
    const closingBookId = menuBookId;
    setMenuBookId(null);
    if (restoreFocus && closingBookId !== null) {
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-book-menu-trigger='${closingBookId}']`)?.focus());
    }
  };

  useEffect(() => {
    if (menuBookId !== null) requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not([disabled])")?.focus());
  }, [menuBookId]);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".book-library-card")) setMenuBookId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && menuBookId !== null) closeMenu(true); };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuBookId]);

  return (
    <div className="books-screen books-library-screen">
      <div className="books-hero">
        <div>
          <span className="books-eyebrow"><Sparkles size={13} /> Long-form workspace</span>
          <h1>A room for the<br /><em>long sentence.</em></h1>
          <p>Shape an idea into a manuscript, one considered page at a time.</p>
        </div>
        <button className="books-primary-action" onClick={onNew} disabled={creating}><Plus size={16} /> {creating ? "Creating…" : "New manuscript"}</button>
      </div>
      <div className="books-section-heading">
        <div><span className="books-eyebrow">Your shelf</span><h2>Manuscripts</h2></div>
        <span className="books-count">{books.length} {books.length === 1 ? "book" : "books"}</span>
      </div>
      {books.length === 0 ? (
        <button className="books-empty-card" onClick={onNew}>
          <div className="books-empty-icon"><BookOpen size={24} /></div>
          <strong>Start your first manuscript</strong>
          <span>Set the voice, build the outline, and write without distraction.</span>
          <span className="books-empty-link">Create a book <ChevronRight size={13} /></span>
        </button>
      ) : (
        <div className="books-library-grid">
          {books.map((book) => (
            <article key={book.id} className="book-library-card">
              <button className="book-library-card-main" onClick={() => { setMenuBookId(null); onOpen(book.id); }}>
                <div className="book-card-topline">{book.status.replace("revising", "in revision")}</div>
                <div className="book-card-cover" style={{ background: book.cover_color || undefined }}><BookOpen size={25} /><span>{book.genre || "MANUSCRIPT"}</span></div>
                <h3>{book.title || "Untitled manuscript"}</h3>
                <p>{book.author || "Author not set"}</p>
              </button>
              <div className="book-card-footer">
                <span>Edited {formatUpdated(book.updated_at)}</span>
                <button data-book-menu-trigger={book.id} onClick={() => setMenuBookId((current) => current === book.id ? null : book.id)} aria-label={`Actions for ${book.title || "untitled manuscript"}`} aria-expanded={menuBookId === book.id} aria-haspopup="menu"><MoreHorizontal size={15} /></button>
              </div>
              {menuBookId === book.id && <div ref={menuRef} className="book-library-menu" role="menu" aria-label={`Actions for ${book.title || "untitled manuscript"}`} onKeyDown={(event) => handleMenuKeyDown(event, () => closeMenu(true))}>
                <button role="menuitem" onClick={() => { setMenuBookId(null); onOpen(book.id); }}><BookOpen size={13} /> Open manuscript</button>
                <button role="menuitem" className="danger" disabled={deletingBookId === book.id} onClick={() => { setMenuBookId(null); onDelete(book); }}><Trash2 size={13} /> {deletingBookId === book.id ? "Deleting…" : "Delete manuscript"}</button>
              </div>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export const SECTION_GROUP_LABELS: Record<"front" | "story" | "back", string> = {
  front: "Opening pages",
  story: "Story",
  back: "Closing pages",
};

function SettingsScreen({ book, chapters, focus }: { book: Book; chapters: Chapter[]; focus?: MatterFocus }) {
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

function ContentsPreview({ book, entries }: { book: Book; entries: TocEntry[] }) {
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

function InteriorPreview({ book, chapters, chapterId }: { book: Book; chapters: Chapter[]; chapterId: number | null }) {
  const orderedChapters = orderBookChapters(chapters);
  const chapter = orderedChapters.find((item) => item.id === chapterId && item.chapter_kind !== "title_page") ?? orderedChapters.find((item) => item.chapter_kind !== "title_page") ?? null;
  if (!chapter) return <div className="books-preview-empty-state"><BookOpen size={20} /><strong>Add a section to preview the interior.</strong><span>The cover preview will use your book metadata.</span></div>;
  const chapterIndex = orderedChapters.indexOf(chapter);
  const band = chapterPageBand(chapter);
  const layout = layoutForBook(book);
  const label = chapterTitleHeading(chapter, chapterIndex, orderedChapters);
  const showKicker = band === "story" && chapterHasDistinctTitle(chapter, chapterIndex, orderedChapters);
  return <div className="books-interior-preview" style={manuscriptStyle(book)}><BooksPageChrome book={book} keyName={layoutSectionKey(band, chapter.id)} section={label} band={band} ordinal={chapterBandOrdinal(orderedChapters, chapterIndex)} />{showKicker && <span className="books-preview-kicker">{chapterDisplayLabel(chapter, chapterIndex, orderedChapters)}</span>}<h2 className="book-heading-1">{label}</h2><article dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content, sectionAnchorId(chapter.id), layout.typography) }} /></div>;
}

function ExportScreen({ book, chapters, onNavigate, onOpenChapter }: { book: Book; chapters: Chapter[]; onNavigate: (screen: StudioScreen) => void; onOpenChapter: (id: number) => void }) {
  const [format, setFormat] = useState<ExportFormat>("epub");
  const [previewMode, setPreviewMode] = useState<"cover" | "interior">("cover");
  const [previewChapterId, setPreviewChapterId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = EXPORT_OPTIONS.find((option) => option.value === format)!;
  const totalWords = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  const toc = useMemo(() => buildBookToc(book, chapters), [book, chapters]);
  const preflight = useMemo(() => bookExportChecks(book, chapters), [book, chapters]);
  const attentionCount = preflight.filter((check) => check.severity !== "info").length;
  const interiorChapters = orderBookChapters(chapters).filter((chapter) => chapter.chapter_kind !== "title_page");
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
            {previewMode === "cover" ? <div className="books-preview-page" style={manuscriptStyle(book)}><BooksPageChrome book={book} keyName="story" section="Chapter 1" band="story" ordinal={0} /><span className="books-preview-kicker">{book.genre || "Manuscript"}</span><h2 className="book-title">{book.title || "Untitled manuscript"}</h2>{book.subtitle && <p className="books-preview-subtitle">{book.subtitle}</p>}<span className="books-preview-author">{book.author || "Author"}</span><div className="books-preview-rule" /><p>{book.description || "Your book description will appear in the front matter and metadata of exported copies."}</p><ContentsPreview book={book} entries={toc} /></div> : <InteriorPreview book={book} chapters={chapters} chapterId={selectedPreviewChapterId} />}
         </div>
       </div>
    </div>
  );
}

function PrintBook({ book, chapters, toc }: { book: Book; chapters: Chapter[]; toc: TocEntry[] }) {
  const layout = layoutForBook(book);
  const orderedChapters = orderBookChapters(chapters);
  const titlePage = orderedChapters.find((chapter) => chapter.chapter_kind === "title_page");
  const front = frontMatterSections(book, chapters);
  const contentChapters = orderedChapters.filter((chapter) => chapter.chapter_kind !== "title_page");
  const back = backMatterSections(book, chapters);
  return (
    <div className="book-print-root" style={manuscriptStyle(book)}>
      <div className="book-print-content">
        <BooksPageChrome book={book} keyName={titlePage ? layoutSectionKey("opening", titlePage.id) : layoutSectionKey("opening")} section={titlePage?.title || "Title page"} band="opening" ordinal={0} />
        <h1 className="book-title">{titlePage?.title || book.title}</h1>
        {!titlePage && book.subtitle && <p className="print-subtitle">{book.subtitle}</p>}
        {!titlePage && book.author && <p className="print-author">{book.author}</p>}
        {titlePage && <div dangerouslySetInnerHTML={{ __html: markdownToHtml(titlePage.content, sectionAnchorId(titlePage.id), layout.typography) }} />}
          {toc.length > 0 && <section className="print-toc print-page-break"><BooksPageChrome book={book} keyName="contents" section={tocTitle(book)} band="contents" ordinal={0} /><h2 className="book-heading-2">{tocTitle(book)}</h2>{toc.map((entry) => <div key={entry.id} style={{ paddingLeft: `${Math.max(0, entry.level - 1) * 14}pt` }}>{entry.label}</div>)}</section>}
          {front.map((section, index) => <section key={section.title} className="print-matter print-page-break"><BooksPageChrome book={book} keyName="opening" section={section.title} band="opening" ordinal={index} /><h2 className="book-heading-1">{section.title}</h2><div dangerouslySetInnerHTML={{ __html: markdownToHtml(section.content, matterAnchorId(section.key), layout.typography) }} /></section>)}
           {contentChapters.map((chapter) => { const index = orderedChapters.indexOf(chapter); const band = chapterPageBand(chapter); const label = chapterTitleHeading(chapter, index, orderedChapters); const showKicker = band === "story" && chapterHasDistinctTitle(chapter, index, orderedChapters); return <section key={chapter.id} id={sectionAnchorId(chapter.id)} className={`${band === "story" ? "" : "print-matter "}print-page-break`}><BooksPageChrome book={book} keyName={layoutSectionKey(band, chapter.id)} section={label} band={band} ordinal={chapterBandOrdinal(orderedChapters, index)} />{showKicker && <p className="print-chapter-kicker">{chapterDisplayLabel(chapter, index, orderedChapters)}</p>}<h2 className="book-heading-1">{label}</h2><div dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content, sectionAnchorId(chapter.id), layout.typography) }} /></section>; })}
           {back.map((section, index) => <section key={section.title} className="print-matter print-page-break"><BooksPageChrome book={book} keyName="closing" section={section.title} band="closing" ordinal={index} /><h2 className="book-heading-1">{section.title}</h2><div dangerouslySetInnerHTML={{ __html: markdownToHtml(section.content, matterAnchorId(section.key), layout.typography) }} /></section>)}
      </div>
    </div>
  );
}

export function BooksStudio() {
  const books = useBooks((state) => state.books);
  const chapters = useBooks((state) => state.chapters);
  const selectedBookId = useBooks((state) => state.selectedBookId);
  const activeChapterId = useBooks((state) => state.activeChapterId);
  const loaded = useBooks((state) => state.loaded);
  const loadError = useBooks((state) => state.error);
  const init = useBooks((state) => state.init);
  const createBook = useBooks((state) => state.createBook);
  const deleteBook = useBooks((state) => state.deleteBook);
  const createChapter = useBooks((state) => state.createChapter);
  const selectBook = useBooks((state) => state.selectBook);
  const selectChapter = useBooks((state) => state.selectChapter);
  const sidebarCollapsed = useWorkspace((state) => state.booksSidebarCollapsed);
  const [screen, setScreen] = useState<StudioScreen>("library");
  const [settingsFocus, setSettingsFocus] = useState<MatterFocus | undefined>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [editorFocusMode, setEditorFocusMode] = useState(false);
  const confirmation = useConfirmationDialog();
  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) ?? null, [books, selectedBookId]);
  const orderedChapters = useMemo(() => orderBookChapters(chapters), [chapters]);
  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId) ?? null;
  const selectedToc = useMemo(() => selectedBook ? buildBookToc(selectedBook, chapters) : [], [selectedBook, chapters]);

  useEffect(() => { void init(); }, [init]);

  const newBook = async () => {
    if (creatingBook) return;
    setCreatingBook(true);
    try {
      const book = await createBook({ title: "Untitled manuscript" });
      await createChapter(book.id, "Chapter 1", "chapter");
      setScreen("manuscript");
    } catch (error) {
      notify("error", "Manuscript could not be created", String(error));
    } finally {
      setCreatingBook(false);
    }
  };
  const removeBook = (book: Book) => {
    const menuTrigger = document.querySelector<HTMLElement>(`[data-book-menu-trigger='${book.id}']`);
    confirmation.ask({
      title: `Delete “${book.title || "Untitled manuscript"}”?`,
      description: "Every section and all manuscript settings in this book will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete manuscript",
      onConfirm: async () => {
        setDeletingBookId(book.id);
        try {
          await deleteBook(book.id);
          setEditorFocusMode(false);
          setScreen("library");
          notify("success", "Manuscript deleted", book.title || "Untitled manuscript");
        } finally {
          setDeletingBookId(null);
        }
      },
    }, menuTrigger);
  };
  const openBook = async (id: number) => {
    try {
      await selectBook(id);
      setScreen("manuscript");
    } catch (error) {
      notify("error", "Manuscript could not be opened", String(error));
    }
  };
  const newChapter = async (kind: ChapterKind = "chapter") => {
    if (selectedBookId !== null) {
      try {
        const chapterNumber = chapters.filter((chapter) => chapter.chapter_kind === "chapter").length + 1;
        await createChapter(selectedBookId, defaultChapterTitle(kind, chapterNumber), kind);
        setScreen("manuscript");
      } catch (error) {
        notify("error", "Section could not be created", String(error));
      }
    }
  };
  const openMatter = (focus: MatterFocus) => { setSettingsFocus(focus); setScreen("settings"); };
  const openChapter = (id: number) => { selectChapter(id); setCommandOpen(false); setSettingsFocus(undefined); setScreen("manuscript"); };
  const navigateSection = (direction: -1 | 1) => {
    if (!activeChapter) return;
    const index = orderedChapters.findIndex((chapter) => chapter.id === activeChapter.id);
    const next = orderedChapters[index + direction];
    if (next) openChapter(next.id);
  };
  const switchScreen = (next: StudioScreen) => { if (next === "manuscript" && !selectedBook) return; if (next !== "manuscript") setEditorFocusMode(false); setCommandOpen(false); setSettingsFocus(undefined); setScreen(next); };

  useEffect(() => {
    const openCommandPalette = () => setCommandOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (selectedBookId === null || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      const nextScreen = ({
        "1": "library",
        "2": "manuscript",
        "3": "outline",
        "4": "settings",
        "5": "export",
      } as Record<string, StudioScreen>)[event.key];
      if (!nextScreen) return;
      event.preventDefault();
      switchScreen(nextScreen);
    };
    window.addEventListener("open-books-palette", openCommandPalette);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("open-books-palette", openCommandPalette);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedBookId, selectedBook]);

  if (!loaded) return <div className="books-loading" role="status"><div className="spinner" /><strong>Opening Books Studio</strong><span>Preparing your local manuscript library…</span></div>;
  if (loadError) return <div className="books-loading books-load-error" role="alert"><BookOpen size={26} /><strong>Books Studio could not open</strong><span>{loadError}</span><button className="books-primary-action" onClick={() => void init()}>Try again</button></div>;
  return (
    <div className={`books-studio ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${editorFocusMode ? "editor-focus-mode" : ""}`}>
      <aside className="books-sidebar">
        <div className="books-sidebar-brand"><div className="books-brand-mark"><BookOpen size={17} /></div><div><strong>Books Studio</strong><span>Long-form writing</span></div></div>
        <button className="books-new-button" onClick={() => void newBook()} disabled={creatingBook}><Plus size={15} /> {creatingBook ? "Creating…" : "New manuscript"}</button>
        <ScreenNav screen={screen} hasBook={Boolean(selectedBook)} onChange={switchScreen} />
        <div className="books-sidebar-divider" />
        <div className="books-shelf-heading"><span>Your shelf</span><button onClick={() => void newBook()} title="New manuscript" aria-label="New manuscript" disabled={creatingBook}><Plus size={13} /></button></div>
         <div className="books-sidebar-books">{books.map((book) => <button key={book.id} className={`books-sidebar-book ${book.id === selectedBookId ? "active" : ""}`} onClick={() => void openBook(book.id)}><span>{book.title || "Untitled manuscript"}</span></button>)}{books.length === 0 && <span className="books-no-books">No manuscripts yet</span>}</div>
         {selectedBook && <SectionsRail chapters={chapters} activeChapterId={activeChapterId} onSelect={openChapter} onNewChapter={(kind) => void newChapter(kind)} />}
       </aside>
       <main className="books-main">
         <div className="books-main-header"><div className="books-breadcrumb"><button onClick={() => switchScreen("library")}>Books Studio</button>{selectedBook && <><ChevronRight size={13} /><strong>{selectedBook.title || "Untitled manuscript"}</strong></>}</div>{selectedBook && <div className="books-header-actions"><span className={`book-status-pill ${selectedBook.status}`}>{selectedBook.status.replace("revising", "in revision")}</span><button className="books-header-icon" onClick={() => switchScreen("settings")} title="Book settings" aria-label="Book settings"><Settings2 size={15} /></button></div>}</div>
            {!selectedBook && screen !== "library" ? <div className="books-no-selection"><ArrowLeft size={20} /><h2>Choose a manuscript first.</h2><button className="books-primary-action" onClick={() => setScreen("library")}>Back to library</button></div> : screen === "library" ? <LibraryScreen books={books} creating={creatingBook} deletingBookId={deletingBookId} onNew={() => void newBook()} onOpen={(id) => void openBook(id)} onDelete={(book) => void removeBook(book)} /> : selectedBook && screen === "manuscript" ? <ManuscriptScreen book={selectedBook} chapters={orderedChapters} activeChapter={activeChapter} focusMode={editorFocusMode} onFocusModeChange={setEditorFocusMode} onOpenOutline={() => switchScreen("outline")} onNewChapter={() => void newChapter()} onNavigateSection={navigateSection} /> : selectedBook && screen === "outline" ? <OutlineScreen book={selectedBook} chapters={chapters} onNewChapter={(kind) => void newChapter(kind)} onOpenMatter={openMatter} onOpenChapter={openChapter} /> : selectedBook && screen === "settings" ? <SettingsScreen book={selectedBook} chapters={chapters} focus={settingsFocus} /> : selectedBook ? <ExportScreen book={selectedBook} chapters={chapters} onNavigate={switchScreen} onOpenChapter={openChapter} /> : null}
          </main>
          {selectedBook && <PrintBook book={selectedBook} chapters={chapters} toc={selectedToc} />}
           <BooksCommandPalette open={commandOpen} bookTitle={selectedBook ? (selectedBook.title || "Untitled manuscript") : undefined} chapters={orderedChapters} onClose={() => setCommandOpen(false)} onNavigate={switchScreen} onNewChapter={(kind) => void newChapter(kind)} onOpenChapter={openChapter} />
           {confirmation.dialog}
     </div>
  );
}
