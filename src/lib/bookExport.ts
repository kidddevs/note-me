import { backMatterSections, buildBookToc, frontMatterSections } from "./bookToc";
import { layoutForBook, layoutForChapter, serializeBookLayout, type BookTextStyle } from "./bookLayout";
import { downloadBlob, hasCoverDocument } from "./bookCoverDoc";
import { bookExportPayload, EXPORT_OPTIONS, filenameFor, hasManuscriptContent, isDocxImageSource, parseImageLine, wordCount, type BookExportFormat, type BookPublishingOptions } from "./bookPublishing";
import { estimateBookPagination } from "./bookPagination";
import { FONT_OPTIONS, normalizeFontFamily } from "./fontFamilies";
import { fontAssetMatches, fontRequestKey, primaryFontFamily, type EmbeddedFont, type FontRequest } from "./fontEmbedding";
import { readSystemFontAsset, type SystemFontAsset } from "./systemFonts";
import { parseChapterWorkflow } from "./bookWorkflow";
import type { Book, Chapter } from "./types";

export { estimateBookPagination } from "./bookPagination";

export type BookExportCheckSeverity = "error" | "warning" | "info";
export type BookExportCheckTarget = "settings" | "outline" | "manuscript";

export type BookOutputFormat = BookExportFormat | "print";

interface BookOutputOption extends Omit<(typeof EXPORT_OPTIONS)[number], "value"> {
  value: BookOutputFormat;
  coverPanel: "front" | "wrap" | null;
}

export const BOOK_OUTPUT_OPTIONS: BookOutputOption[] = [
  ...EXPORT_OPTIONS.map((option): BookOutputOption => ({
    ...option,
    coverPanel: option.value === "epub" || option.value === "html" ? "front" : null,
  })),
  { value: "print", label: "Print / PDF", description: "Paginated proof with an optional cover", extension: ".pdf", mime: "application/pdf", coverPanel: "wrap", note: "Choose Save as PDF in the print dialog. On macOS, the selected paper size sets the dimensions of every page." },
];

export interface BookExportChoices {
  includeCover?: boolean;
  includeContents?: boolean;
  embedFonts?: boolean;
}

/** Resolve one edition without writing the manuscript's publication settings. */
export function bookForExport(book: Book, format: BookOutputFormat, choices: BookExportChoices = {}): Book {
  const layout = layoutForBook(book);
  const supportsCover = Boolean(BOOK_OUTPUT_OPTIONS.find((option) => option.value === format)?.coverPanel);
  const coverAvailable = layout.cover.enabled || hasCoverDocument(layout.cover);
  const coverEnabled = supportsCover && coverAvailable && (choices.includeCover ?? layout.cover.enabled);
  const tocEnabled = choices.includeContents ?? book.toc_enabled;
  if (coverEnabled === layout.cover.enabled && tocEnabled === book.toc_enabled) return book;
  return {
    ...book,
    toc_enabled: tocEnabled,
    layout_json: coverEnabled === layout.cover.enabled ? book.layout_json : serializeBookLayout({ ...layout, cover: { ...layout.cover, enabled: coverEnabled } }),
  };
}

export interface BookExportCheck {
  id: string;
  label: string;
  detail: string;
  severity: BookExportCheckSeverity;
  target: BookExportCheckTarget;
  chapterId?: number;
}

const STORY_KINDS = new Set(["editorial", "prologue", "chapter", "feature", "department", "column", "profile", "interview", "review", "photo_essay", "recipe", "listing", "interlude"]);

function normalizedFontWeight(value: number) {
  return Math.min(900, Math.max(100, Math.round(value / 100) * 100));
}

export function customFontRequests(book: Book, layout: ReturnType<typeof layoutForBook>, chapters: Chapter[] = []) {
  const requests: FontRequest[] = [];
  const seen = new Set<string>();
  const add = (value: string, weight = 400, style: "normal" | "italic" = "normal") => {
    const normalized = normalizeFontFamily(value);
    if (!normalized || FONT_OPTIONS.some((option) => option.value === value.trim())) return;
    const request = { family: normalized, weight: normalizedFontWeight(weight), style } satisfies FontRequest;
    const key = fontRequestKey(request);
    if (seen.has(key)) return;
    seen.add(key);
    requests.push(request);
  };

  const addStyle = (style: BookTextStyle) => {
    add(style.fontFamily, style.fontWeight, style.fontStyle);
    add(style.dropCapFontFamily, Math.max(400, style.fontWeight), style.fontStyle);
    const nestedWeight = style.nestedStyle === "bold" ? 700 : style.fontWeight;
    const nestedStyle = style.nestedStyle === "italic" ? "italic" : style.fontStyle;
    add(style.nestedFontFamily, nestedWeight, nestedStyle);
  };

  const addLayoutFonts = (source: ReturnType<typeof layoutForBook>) => {
    for (const style of Object.values(source.typography)) addStyle(style);
    for (const preset of source.paragraphStyles) addStyle(preset.style);
    for (const layer of source.cover.doc.layers) {
      if (layer.type === "text") add(layer.customFont, layer.fontWeight, layer.italic ? "italic" : "normal");
    }
  };

  add(book.font_family, 400, "normal");
  addLayoutFonts(layout);
  for (const chapter of chapters) addLayoutFonts(layoutForChapter(book, chapter));
  return requests;
}

export function customFontFamilies(book: Book, layout: ReturnType<typeof layoutForBook>, chapters: Chapter[] = []) {
  const families: string[] = [];
  const seen = new Set<string>();
  for (const request of customFontRequests(book, layout, chapters)) {
    const key = primaryFontFamily(request.family).toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    families.push(request.family);
  }
  return families;
}

export function matchingFontAssets(customFonts: string[], assets: SystemFontAsset[]) {
  return fontAssetMatches(customFonts.map((family) => ({ family, weight: 400, style: "normal" })), assets)
    .filter((match) => match.exact)
    .map((match) => match.asset);
}

export function matchingFontAssetMatches(requests: FontRequest[], assets: SystemFontAsset[]) {
  return fontAssetMatches(requests, assets);
}

function paginationRuleWarning(book: Book, layout: ReturnType<typeof layoutForBook>, chapters: Chapter[]) {
  const layouts = [
    { label: "Book", layout },
    ...chapters.map((chapter) => ({ label: chapter.title.trim() || `Section ${chapter.id}`, layout: layoutForChapter(book, chapter) })),
  ];
  const styles = layouts.flatMap(({ label: layoutLabel, layout: source }) => [
    ...Object.entries(source.typography).map(([label, style]) => ({ label: `${layoutLabel} · ${label}`, style })),
    ...source.paragraphStyles.map((preset) => ({ label: `${layoutLabel} · ${preset.name}`, style: preset.style })),
  ]);
  const bothBreaks = styles.filter(({ style }) => style.breakBefore && style.breakAfter).map(({ label }) => label);
  const keepAfterBreak = styles.filter(({ style }) => style.keepWithNext && style.breakAfter).map(({ label }) => label);
  if (!bothBreaks.length && !keepAfterBreak.length) return null;
  const labels = [...new Set([...bothBreaks, ...keepAfterBreak])].slice(0, 3).join(", ");
  const suffix = labels ? ` (${labels}${bothBreaks.length + keepAfterBreak.length > 3 ? ", …" : ""})` : "";
  return {
    id: "pagination-rules",
    label: "Review pagination rules",
    detail: `One or more styles force a break alongside another page-keeping rule${suffix}. Check the result in Print / PDF before sharing.`,
    severity: "warning" as const,
    target: "settings" as const,
  };
}

export function bookExportChecks(book: Book, chapters: Chapter[], format: BookOutputFormat = "html", options: { embedFonts?: boolean; embeddedFontFamilies?: string[]; embeddedFontRequests?: FontRequest[] } = {}): BookExportCheck[] {
  const checks: BookExportCheck[] = [];
  const title = book.title.trim();

  if (!title || title.toLocaleLowerCase() === "untitled manuscript") {
    checks.push({ id: "title", label: "Name the manuscript", detail: "Replace the working title before sharing a reader copy.", severity: "warning", target: "settings" });
  }
  if (!book.author.trim()) {
    checks.push({ id: "author", label: "Add the author name", detail: "Set the author credited on the reader copy.", severity: "warning", target: "settings" });
  }
  if (!book.description.trim()) {
    checks.push({ id: "description", label: "Add a book description", detail: "A short description improves ebook metadata and the exported cover page.", severity: "info", target: "settings" });
  }
  if (chapters.length === 0) {
    checks.push({ id: "sections", label: "Add a manuscript section", detail: "There is no writing to include in an exported file yet.", severity: "error", target: "manuscript" });
    return checks;
  }

  const emptyStorySections = chapters.filter((chapter) => STORY_KINDS.has(chapter.chapter_kind) && !hasManuscriptContent(chapter.content));
  if (emptyStorySections.length) {
    checks.push({
      id: "empty-sections",
      label: `${emptyStorySections.length} empty story ${emptyStorySections.length === 1 ? "section" : "sections"}`,
      detail: "Review empty chapters before sending the manuscript to a reader.",
      severity: "warning",
      target: "manuscript",
      chapterId: emptyStorySections[0].id,
    });
  }

  if (book.toc_enabled && buildBookToc(book, chapters).length === 0) {
    checks.push({ id: "contents", label: "Contents has no entries", detail: "Include a section or heading, or turn off the generated contents page.", severity: "warning", target: "outline" });
  }

  const normalizedTitles = chapters.map((chapter) => chapter.title.trim().toLocaleLowerCase()).filter(Boolean);
  const duplicateTitles = new Set(normalizedTitles.filter((titleValue, index) => normalizedTitles.indexOf(titleValue) !== index));
  if (duplicateTitles.size) {
    checks.push({ id: "duplicate-titles", label: "Review repeated section titles", detail: "Repeated titles can make the contents and reader navigation ambiguous.", severity: "info", target: "outline" });
  }

  if (!chapters.some((chapter) => chapter.chapter_kind === "title_page" || chapter.chapter_kind === "cover")) {
    checks.push({ id: "title-page", label: "Consider a title page", detail: "A dedicated title page gives print and editable exports a finished opening.", severity: "info", target: "outline" });
  }

  const layout = layoutForBook(book);
  const fontRequests = customFontRequests(book, layout, chapters);
  const embeddedFamilies = new Set((options.embeddedFontFamilies ?? []).map((family) => primaryFontFamily(family).toLocaleLowerCase()));
  const embeddedRequests = new Set((options.embeddedFontRequests ?? []).map(fontRequestKey));
  const missingEmbeddedRequests = fontRequests.filter((request) => !embeddedRequests.has(fontRequestKey(request)) && !embeddedFamilies.has(primaryFontFamily(request.family).toLocaleLowerCase()));
  const missingEmbeddedFonts = [...new Set(missingEmbeddedRequests.map((request) => request.family))];
  if (missingEmbeddedRequests.length > 0 && ["epub", "docx", "html"].includes(format)) {
    checks.push({
      id: "font-portability",
      label: `${missingEmbeddedFonts.length} custom font ${missingEmbeddedFonts.length === 1 ? "family" : "families"} need a fallback`,
      detail: options.embedFonts
        ? "One or more selected families has no matching readable TTF or OTF weight/style asset in this app session. The remaining family names will travel with the export and need a fallback."
        : "Portable exports preserve the selected family name, but the default export does not embed font binaries. Enable licensed embedding below when you have permission to redistribute the matching files.",
      severity: "warning",
      target: "settings",
    });
  }

  const paginationWarning = paginationRuleWarning(book, layout, chapters);
  if (paginationWarning) checks.push(paginationWarning);

  return checks;
}

export type BookPackageCover = "layered" | "template" | "off";

export interface BookPackageSummary {
  sections: number;
  words: number;
  readingMinutes: number;
  readySections: number;
  cover: BookPackageCover;
  contentsEntries: number;
  images: number;
  imageReferences: number;
  imageDescriptions: number;
  imageCredits: boolean;
  estimatedPages: number;
  customFonts: string[];
}

/** Describe the selected edition using the same artwork rules as its builder. */
export function bookPackageSummary(book: Book, chapters: Chapter[], format: BookOutputFormat = "html"): BookPackageSummary {
  const layout = layoutForBook(book);
  const words = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  const sections = [...chapters, ...frontMatterSections(book, chapters), ...backMatterSections(book, chapters)];
  const artwork = sections.flatMap((section) => section.content.split(/\r?\n/).map(parseImageLine).filter((image) => image !== null));
  const placedArtwork = format === "docx" ? artwork.filter((image) => isDocxImageSource(image.source))
    : format === "txt" || format === "markdown" ? [] : artwork;
  const supportsCover = Boolean(BOOK_OUTPUT_OPTIONS.find((option) => option.value === format)?.coverPanel);
  const pagination = estimateBookPagination(book, chapters);
  return {
    sections: chapters.length,
    words,
    readingMinutes: words > 0 ? Math.max(1, Math.round(words / 250)) : 0,
    readySections: chapters.filter((chapter) => parseChapterWorkflow(chapter.workflow_json).status === "ready").length,
    cover: !supportsCover || !layout.cover.enabled ? "off" : hasCoverDocument(layout.cover) ? "layered" : "template",
    contentsEntries: buildBookToc(book, chapters).length,
    images: placedArtwork.length,
    imageReferences: format === "markdown" ? artwork.length : 0,
    imageDescriptions: format === "txt" || format === "docx" ? artwork.length - placedArtwork.length : 0,
    imageCredits: (format === "txt" ? [] : artwork).some((image) => Boolean(image.presentation.credit)),
    estimatedPages: pagination.estimatedPages,
    customFonts: customFontFamilies(book, layout, chapters),
  };
}

export interface BookExportCheckGroups {
  attention: BookExportCheck[];
  suggestions: BookExportCheck[];
}

/** Errors and warnings stay together above the optional finishing suggestions. */
export function groupBookExportChecks(checks: BookExportCheck[]): BookExportCheckGroups {
  return {
    attention: checks.filter((check) => check.severity !== "info"),
    suggestions: checks.filter((check) => check.severity === "info"),
  };
}

export interface BookExportReceipt {
  filename: string;
  path: string | null;
  bytes: number;
}

export interface BookExportOptions {
  embedFonts?: boolean;
  fontAssets?: SystemFontAsset[];
}

async function fontOptionsForExport(book: Book, chapters: Chapter[], options: BookExportOptions): Promise<BookPublishingOptions> {
  if (!options.embedFonts) return {};
  const requests = customFontRequests(book, layoutForBook(book), chapters);
  if (requests.length === 0) return {};
  const matches = matchingFontAssetMatches(requests, options.fontAssets ?? []);
  const missing = matches.filter((match) => !match.exact).map((match) => `${match.request.family} (${match.request.weight} ${match.request.style})`);
  const matchedKeys = new Set(matches.map((match) => fontRequestKey(match.request)));
  const missingRequests = requests.filter((request) => !matchedKeys.has(fontRequestKey(request)));
  missing.push(...missingRequests.map((request) => `${request.family} (${request.weight} ${request.style})`));
  if (missing.length > 0) {
    throw new Error(`Could not match every selected font variant. Choose readable TTF or OTF files for ${missing.join(", ")}, or export with embedding off.`);
  }
  const embeddedFonts: EmbeddedFont[] = await Promise.all(matches.map(async (match) => {
    const data = await readSystemFontAsset(match.asset);
    if (data.extension !== "ttf" && data.extension !== "otf") throw new Error(`The ${match.asset.family} font file is not embeddable in this export.`);
    return { family: primaryFontFamily(match.request.family), format: data.extension, bytes: data.bytes, weight: match.request.weight, style: match.request.style };
  }));
  return { embeddedFonts };
}

/** Save the resolved edition using the system dialog or the browser downloader. */
export async function saveBookExport(book: Book, chapters: Chapter[], format: BookExportFormat, options: BookExportOptions = {}): Promise<BookExportReceipt | null> {
  const option = EXPORT_OPTIONS.find((item) => item.value === format);
  if (!option) throw new Error(`Unsupported book export format: ${format}`);
  const filename = filenameFor(book, option.extension);
  const publishingOptions = await fontOptionsForExport(book, chapters, options);
  if (!("__TAURI_INTERNALS__" in window)) {
    const payload = await bookExportPayload(book, chapters, format, publishingOptions);
    const blob = new Blob([typeof payload === "string" ? payload : new Uint8Array(payload)], { type: option.mime });
    downloadBlob(blob, filename);
    return { filename, path: null, bytes: blob.size };
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: filename, filters: [{ name: option.label, extensions: [option.extension.slice(1)] }] });
  if (!path) return null;
  const payload = await bookExportPayload(book, chapters, format, publishingOptions);
  const { writeFile, writeTextFile } = await import("@tauri-apps/plugin-fs");
  if (typeof payload === "string") await writeTextFile(path, payload);
  else await writeFile(path, payload);
  return {
    filename: path.split(/[\\/]/).pop() || filename,
    path,
    bytes: typeof payload === "string" ? new TextEncoder().encode(payload).length : payload.byteLength,
  };
}
