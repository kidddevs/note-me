import type { Book } from "./types";

export type BookChromePosition = "left" | "center" | "right";
export type BookPageNumberStyle = "arabic" | "roman-lower" | "roman-upper" | "custom";
export type BookPageStartSection = "opening" | "contents" | "story" | "closing";
export type BookTextAlign = "left" | "center" | "right" | "justify";
export type BookTextFontStyle = "normal" | "italic";
export type BookNestedStyle = "none" | "small-caps" | "bold" | "italic" | "accent";
export type BookTextRole = "title" | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6" | "paragraph" | "quote";
export type BookTextCase = "none" | "uppercase" | "lowercase" | "small-caps";
export type BookRuleStyle = "solid" | "dashed" | "dotted" | "double";
export type BookGrepStyle = "none" | "bold" | "italic" | "accent" | "small-caps";
export type BookBulletType = "bullet" | "number";

export interface BookChrome {
  left: string;
  center: string;
  right: string;
}

export interface BookPageNumberRule {
  enabled: boolean;
  style: BookPageNumberStyle;
  start: number;
  customFormat: string;
}

export interface BookPageNumbering {
  enabled: boolean;
  placement: BookChromePosition;
  style: BookPageNumberStyle;
  start: number;
  startSection: BookPageStartSection;
  customFormat: string;
  rules: Record<string, BookPageNumberRule>;
}

export interface BookParagraphRule {
  enabled: boolean;
  width: number;
  color: string;
  style: BookRuleStyle;
  offset: number;
}

export interface BookParagraphBorder {
  enabled: boolean;
  width: number;
  color: string;
  style: BookRuleStyle;
  padding: number;
  radius: number;
}

export interface BookParagraphShading {
  enabled: boolean;
  color: string;
}

export interface BookBulletStyle {
  enabled: boolean;
  type: BookBulletType;
  marker: string;
  indent: number;
}

export interface BookGrepRule {
  enabled: boolean;
  pattern: string;
  style: BookGrepStyle;
  color: string;
}

export interface BookTabStop {
  position: number;
  align: "left" | "center" | "right";
}

export interface BookTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: BookTextFontStyle;
  textAlign: BookTextAlign;
  lineHeight: number;
  letterSpacing: number;
  firstLineIndent: number;
  leftIndent: number;
  rightIndent: number;
  spaceBefore: number;
  spaceAfter: number;
  dropCap: boolean;
  dropCapLines: number;
  dropCapGap: number;
  dropCapFontFamily: string;
  dropCapColor: string;
  nestedStyle: BookNestedStyle;
  nestedWords: number;
  nestedFontFamily: string;
  nestedColor: string;
  color: string;
  underline: boolean;
  strikethrough: boolean;
  textCase: BookTextCase;
  hyphenation: boolean;
  keepWithNext: boolean;
  columns: number;
  columnGap: number;
  ruleAbove: BookParagraphRule;
  ruleBelow: BookParagraphRule;
  border: BookParagraphBorder;
  shading: BookParagraphShading;
  bullets: BookBulletStyle;
  grep: BookGrepRule;
  tabs: BookTabStop[];
}

export type BookTypography = Record<BookTextRole, BookTextStyle>;

export interface BookParagraphStyle {
  id: string;
  name: string;
  style: BookTextStyle;
}

export interface BookPageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BookLayout {
  header: BookChrome;
  footer: BookChrome;
  pageNumbering: BookPageNumbering;
  pageMargins: BookPageMargins;
  pageColor: string;
  accentColor: string;
  typography: BookTypography;
  paragraphStyles: BookParagraphStyle[];
}

export const DEFAULT_BOOK_PAGE_MARGINS: BookPageMargins = {
  top: 1,
  right: 1,
  bottom: 1,
  left: 1,
};

const DEFAULT_STYLE: BookTextStyle = {
  fontFamily: "serif",
  fontSize: 12,
  fontWeight: 400,
  fontStyle: "normal",
  textAlign: "justify",
  lineHeight: 1.5,
  letterSpacing: 0,
  firstLineIndent: 0,
  leftIndent: 0,
  rightIndent: 0,
  spaceBefore: 0,
  spaceAfter: 0,
  dropCap: false,
  dropCapLines: 3,
  dropCapGap: 0.15,
  dropCapFontFamily: "serif",
  dropCapColor: "#a56b3e",
  nestedStyle: "none",
  nestedWords: 3,
  nestedFontFamily: "serif",
  nestedColor: "#a56b3e",
  color: "inherit",
  underline: false,
  strikethrough: false,
  textCase: "none",
  hyphenation: false,
  keepWithNext: false,
  columns: 1,
  columnGap: 2,
  ruleAbove: { enabled: false, width: 1, color: "accent", style: "solid", offset: 0 },
  ruleBelow: { enabled: false, width: 1, color: "accent", style: "solid", offset: 0 },
  border: { enabled: false, width: 1, color: "accent", style: "solid", padding: 0, radius: 0 },
  shading: { enabled: false, color: "#a56b3e" },
  bullets: { enabled: false, type: "bullet", marker: "•", indent: 1.2 },
  grep: { enabled: false, pattern: "", style: "accent", color: "accent" },
  tabs: [],
};

export const DEFAULT_BOOK_TYPOGRAPHY: BookTypography = {
  title: { ...DEFAULT_STYLE, fontSize: 30, fontWeight: 600, textAlign: "left", lineHeight: 1.08 },
  heading1: { ...DEFAULT_STYLE, fontSize: 25, fontWeight: 600, textAlign: "left", lineHeight: 1.12 },
  heading2: { ...DEFAULT_STYLE, fontSize: 21, fontWeight: 600, textAlign: "left", lineHeight: 1.16 },
  heading3: { ...DEFAULT_STYLE, fontSize: 18, fontWeight: 600, textAlign: "left", lineHeight: 1.2 },
  heading4: { ...DEFAULT_STYLE, fontSize: 15, fontWeight: 600, textAlign: "left", lineHeight: 1.25 },
  heading5: { ...DEFAULT_STYLE, fontSize: 13, fontWeight: 600, textAlign: "left", lineHeight: 1.3 },
  heading6: { ...DEFAULT_STYLE, fontSize: 11, fontWeight: 700, textAlign: "left", lineHeight: 1.35, letterSpacing: 0.08 },
  paragraph: { ...DEFAULT_STYLE },
  quote: { ...DEFAULT_STYLE, fontStyle: "italic", textAlign: "left", lineHeight: 1.6 },
};

export const DEFAULT_PARAGRAPH_STYLES: BookParagraphStyle[] = [
  { id: "body-classic", name: "Body — Classic", style: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph } },
  {
    id: "body-modern",
    name: "Body — Modern",
    style: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph, fontFamily: "sans", fontSize: 10.5, lineHeight: 1.6, textAlign: "left", spaceAfter: 0.7 },
  },
  {
    id: "lead",
    name: "Lead paragraph",
    style: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph, fontSize: 15, lineHeight: 1.45, textAlign: "left", firstLineIndent: 0, spaceAfter: 1.1, color: "inherit" },
  },
  { id: "display-title", name: "Display title", style: { ...DEFAULT_BOOK_TYPOGRAPHY.title } },
  { id: "section-heading", name: "Section heading", style: { ...DEFAULT_BOOK_TYPOGRAPHY.heading1 } },
  {
    id: "pull-quote",
    name: "Pull quote",
    style: {
      ...DEFAULT_BOOK_TYPOGRAPHY.quote,
      fontSize: 18,
      textAlign: "center",
      firstLineIndent: 0,
      leftIndent: 1.2,
      rightIndent: 1.2,
      spaceBefore: 1.2,
      spaceAfter: 1.2,
      ruleAbove: { enabled: true, width: 1, color: "accent", style: "solid", offset: 0.6 },
      ruleBelow: { enabled: true, width: 1, color: "accent", style: "solid", offset: 0.6 },
    },
  },
  {
    id: "caption",
    name: "Caption",
    style: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph, fontFamily: "sans", fontSize: 8.5, fontStyle: "italic", textAlign: "center", firstLineIndent: 0, lineHeight: 1.4, color: "#6f6259" },
  },
  {
    id: "feature-opening",
    name: "Feature opening",
    style: {
      ...DEFAULT_BOOK_TYPOGRAPHY.paragraph,
      fontSize: 13,
      lineHeight: 1.55,
      firstLineIndent: 0,
      dropCap: true,
      dropCapLines: 3,
      nestedStyle: "small-caps",
      nestedWords: 4,
    },
  },
  {
    id: "sidebar-note",
    name: "Sidebar note",
    style: {
      ...DEFAULT_BOOK_TYPOGRAPHY.paragraph,
      fontFamily: "sans",
      fontSize: 9,
      lineHeight: 1.5,
      firstLineIndent: 0,
      spaceBefore: 0.4,
      spaceAfter: 0.4,
      border: { enabled: true, width: 1, color: "accent", style: "solid", padding: 0.8, radius: 7 },
      shading: { enabled: true, color: "accent" },
    },
  },
];

export const DEFAULT_BOOK_LAYOUT: BookLayout = {
  header: { left: "", center: "", right: "" },
  footer: { left: "", center: "", right: "" },
  pageNumbering: {
    enabled: false,
    placement: "center",
    style: "arabic",
    start: 1,
    startSection: "story",
    customFormat: "{n}",
    rules: {},
  },
  pageMargins: DEFAULT_BOOK_PAGE_MARGINS,
  pageColor: "#ffffff",
  accentColor: "#a56b3e",
  typography: DEFAULT_BOOK_TYPOGRAPHY,
  paragraphStyles: DEFAULT_PARAGRAPH_STYLES,
};

const PAGE_STYLES: BookPageNumberStyle[] = ["arabic", "roman-lower", "roman-upper", "custom"];
const PAGE_SECTIONS: BookPageStartSection[] = ["opening", "contents", "story", "closing"];
const POSITIONS: BookChromePosition[] = ["left", "center", "right"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

function pageStyle(value: unknown, fallback: BookPageNumberStyle) {
  return PAGE_STYLES.includes(value as BookPageNumberStyle) ? value as BookPageNumberStyle : fallback;
}

function pageSection(value: unknown, fallback: BookPageStartSection) {
  return PAGE_SECTIONS.includes(value as BookPageStartSection) ? value as BookPageStartSection : fallback;
}

function position(value: unknown, fallback: BookChromePosition) {
  return POSITIONS.includes(value as BookChromePosition) ? value as BookChromePosition : fallback;
}

function align(value: unknown, fallback: BookTextAlign) {
  return ["left", "center", "right", "justify"].includes(value as string) ? value as BookTextAlign : fallback;
}

function fontStyle(value: unknown, fallback: BookTextFontStyle) {
  return value === "italic" || value === "normal" ? value : fallback;
}

function decimal(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function whole(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function nestedStyle(value: unknown, fallback: BookNestedStyle) {
  return ["none", "small-caps", "bold", "italic", "accent"].includes(value as string) ? value as BookNestedStyle : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function interfaceColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (value === "inherit" || value === "accent" || /^#[0-9a-f]{3,8}$/i.test(value)) return value;
  return fallback;
}

function textCase(value: unknown, fallback: BookTextCase) {
  return ["none", "uppercase", "lowercase", "small-caps"].includes(value as string) ? value as BookTextCase : fallback;
}

function ruleStyle(value: unknown, fallback: BookRuleStyle) {
  return ["solid", "dashed", "dotted", "double"].includes(value as string) ? value as BookRuleStyle : fallback;
}

function bulletType(value: unknown, fallback: BookBulletType) {
  return value === "number" || value === "bullet" ? value : fallback;
}

function grepStyle(value: unknown, fallback: BookGrepStyle) {
  return ["none", "bold", "italic", "accent", "small-caps"].includes(value as string) ? value as BookGrepStyle : fallback;
}

function paragraphRule(value: unknown, fallback: BookParagraphRule): BookParagraphRule {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, fallback.enabled),
    width: decimal(source.width, fallback.width, 0, 8),
    color: interfaceColor(source.color, fallback.color),
    style: ruleStyle(source.style, fallback.style),
    offset: decimal(source.offset, fallback.offset, 0, 3),
  };
}

function paragraphBorder(value: unknown, fallback: BookParagraphBorder): BookParagraphBorder {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, fallback.enabled),
    width: decimal(source.width, fallback.width, 0, 8),
    color: interfaceColor(source.color, fallback.color),
    style: ruleStyle(source.style, fallback.style),
    padding: decimal(source.padding, fallback.padding, 0, 4),
    radius: decimal(source.radius, fallback.radius, 0, 40),
  };
}

function paragraphShading(value: unknown, fallback: BookParagraphShading): BookParagraphShading {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, fallback.enabled),
    color: interfaceColor(source.color, fallback.color),
  };
}

function bulletStyle(value: unknown, fallback: BookBulletStyle): BookBulletStyle {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, fallback.enabled),
    type: bulletType(source.type, fallback.type),
    marker: text(source.marker) || fallback.marker,
    indent: decimal(source.indent, fallback.indent, 0, 8),
  };
}

function grepRule(value: unknown, fallback: BookGrepRule): BookGrepRule {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, fallback.enabled),
    pattern: text(source.pattern).slice(0, 240),
    style: grepStyle(source.style, fallback.style),
    color: interfaceColor(source.color, fallback.color),
  };
}

function tabStops(value: unknown, fallback: BookTabStop[]): BookTabStop[] {
  if (!Array.isArray(value)) return fallback.map((tab) => ({ ...tab }));
  return value.slice(0, 12).map((item) => {
    const source = isRecord(item) ? item : {};
    return {
      position: decimal(source.position, 0, 0, 20),
      align: ["left", "center", "right"].includes(String(source.align)) ? source.align as BookTabStop["align"] : "left",
    };
  });
}

function chrome(value: unknown, fallback: BookChrome): BookChrome {
  const source = isRecord(value) ? value : {};
  return {
    left: text(source.left) || fallback.left,
    center: text(source.center) || fallback.center,
    right: text(source.right) || fallback.right,
  };
}

function rule(value: unknown, fallback: BookPageNumberRule): BookPageNumberRule {
  const source = isRecord(value) ? value : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    style: pageStyle(source.style, fallback.style),
    start: number(source.start, fallback.start),
    customFormat: text(source.customFormat) || fallback.customFormat,
  };
}

function pageMargins(value: unknown, fallback: BookPageMargins): BookPageMargins {
  const source = isRecord(value) ? value : {};
  return {
    top: decimal(source.top, fallback.top, 0.2, 3),
    right: decimal(source.right, fallback.right, 0.2, 3),
    bottom: decimal(source.bottom, fallback.bottom, 0.2, 3),
    left: decimal(source.left, fallback.left, 0.2, 3),
  };
}

function textStyle(value: unknown, fallback: BookTextStyle): BookTextStyle {
  const source = isRecord(value) ? value : {};
  return {
    fontFamily: text(source.fontFamily) || fallback.fontFamily,
    fontSize: decimal(source.fontSize, fallback.fontSize, 6, 96),
    fontWeight: Math.round(decimal(source.fontWeight, fallback.fontWeight, 300, 900) / 100) * 100,
    fontStyle: fontStyle(source.fontStyle, fallback.fontStyle),
    textAlign: align(source.textAlign, fallback.textAlign),
    lineHeight: decimal(source.lineHeight, fallback.lineHeight, 0.8, 3),
    letterSpacing: decimal(source.letterSpacing, fallback.letterSpacing, -0.2, 1),
    firstLineIndent: decimal(source.firstLineIndent, fallback.firstLineIndent, -2, 8),
    leftIndent: decimal(source.leftIndent, fallback.leftIndent, 0, 8),
    rightIndent: decimal(source.rightIndent, fallback.rightIndent, 0, 8),
    spaceBefore: decimal(source.spaceBefore, fallback.spaceBefore, 0, 4),
    spaceAfter: decimal(source.spaceAfter, fallback.spaceAfter, 0, 4),
    dropCap: boolean(source.dropCap, fallback.dropCap),
    dropCapLines: whole(source.dropCapLines, fallback.dropCapLines, 2, 6),
    dropCapGap: decimal(source.dropCapGap, fallback.dropCapGap, 0, 1),
    dropCapFontFamily: text(source.dropCapFontFamily) || fallback.dropCapFontFamily,
    dropCapColor: color(source.dropCapColor, fallback.dropCapColor),
    nestedStyle: nestedStyle(source.nestedStyle, fallback.nestedStyle),
    nestedWords: whole(source.nestedWords, fallback.nestedWords, 1, 12),
    nestedFontFamily: text(source.nestedFontFamily) || fallback.nestedFontFamily,
    nestedColor: color(source.nestedColor, fallback.nestedColor),
    color: interfaceColor(source.color, fallback.color),
    underline: boolean(source.underline, fallback.underline),
    strikethrough: boolean(source.strikethrough, fallback.strikethrough),
    textCase: textCase(source.textCase, fallback.textCase),
    hyphenation: boolean(source.hyphenation, fallback.hyphenation),
    keepWithNext: boolean(source.keepWithNext, fallback.keepWithNext),
    columns: whole(source.columns, fallback.columns, 1, 4),
    columnGap: decimal(source.columnGap, fallback.columnGap, 0, 4),
    ruleAbove: paragraphRule(source.ruleAbove, fallback.ruleAbove),
    ruleBelow: paragraphRule(source.ruleBelow, fallback.ruleBelow),
    border: paragraphBorder(source.border, fallback.border),
    shading: paragraphShading(source.shading, fallback.shading),
    bullets: bulletStyle(source.bullets, fallback.bullets),
    grep: grepRule(source.grep, fallback.grep),
    tabs: tabStops(source.tabs, fallback.tabs),
  };
}

function paragraphStyle(value: unknown, fallback: BookParagraphStyle): BookParagraphStyle {
  const source = isRecord(value) ? value : {};
  const id = text(source.id).replace(/[^a-z0-9_-]/gi, "-").replace(/^-+|-+$/g, "").slice(0, 64) || fallback.id;
  return {
    id,
    name: text(source.name).slice(0, 80) || fallback.name,
    style: textStyle(source.style, fallback.style),
  };
}

function paragraphStyles(value: unknown): BookParagraphStyle[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_PARAGRAPH_STYLES.map((preset) => ({ ...preset, style: { ...preset.style } }));
  const used = new Set<string>();
  const styles = value.slice(0, 80).map((item, index) => {
    const fallback = DEFAULT_PARAGRAPH_STYLES[index % DEFAULT_PARAGRAPH_STYLES.length];
    const parsed = paragraphStyle(item, fallback);
    let id = parsed.id;
    if (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return { ...parsed, id };
  });
  return styles.length ? styles : DEFAULT_PARAGRAPH_STYLES.map((preset) => ({ ...preset, style: { ...preset.style } }));
}

export function parseBookLayout(value?: string, typographyFallback: BookTypography = DEFAULT_BOOK_TYPOGRAPHY, marginsFallback: BookPageMargins = DEFAULT_BOOK_PAGE_MARGINS): BookLayout {
  let parsed: unknown;
  try {
    parsed = value ? JSON.parse(value) : undefined;
  } catch {
    parsed = undefined;
  }
  const source = isRecord(parsed) ? parsed : {};
  const sourceNumbering = isRecord(source.pageNumbering) ? source.pageNumbering : {};
  const sourceRules = isRecord(sourceNumbering.rules) ? sourceNumbering.rules : {};
  const sourceTypography = isRecord(source.typography) ? source.typography : {};
  const fallbackRule: BookPageNumberRule = {
    enabled: true,
    style: pageStyle(sourceNumbering.style, DEFAULT_BOOK_LAYOUT.pageNumbering.style),
    start: number(sourceNumbering.start, DEFAULT_BOOK_LAYOUT.pageNumbering.start),
    customFormat: text(sourceNumbering.customFormat) || DEFAULT_BOOK_LAYOUT.pageNumbering.customFormat,
  };
  const rules = Object.fromEntries(Object.entries(sourceRules).map(([key, value]) => [key, rule(value, fallbackRule)]));
  return {
    header: chrome(source.header, DEFAULT_BOOK_LAYOUT.header),
    footer: chrome(source.footer, DEFAULT_BOOK_LAYOUT.footer),
    pageNumbering: {
      enabled: typeof sourceNumbering.enabled === "boolean" ? sourceNumbering.enabled : DEFAULT_BOOK_LAYOUT.pageNumbering.enabled,
      placement: position(sourceNumbering.placement, DEFAULT_BOOK_LAYOUT.pageNumbering.placement),
      style: pageStyle(sourceNumbering.style, DEFAULT_BOOK_LAYOUT.pageNumbering.style),
      start: number(sourceNumbering.start, DEFAULT_BOOK_LAYOUT.pageNumbering.start),
      startSection: pageSection(sourceNumbering.startSection, DEFAULT_BOOK_LAYOUT.pageNumbering.startSection),
      customFormat: text(sourceNumbering.customFormat) || DEFAULT_BOOK_LAYOUT.pageNumbering.customFormat,
      rules,
    },
    pageMargins: pageMargins(source.pageMargins, marginsFallback),
    pageColor: color(source.pageColor, DEFAULT_BOOK_LAYOUT.pageColor),
    accentColor: color(source.accentColor, DEFAULT_BOOK_LAYOUT.accentColor),
    typography: Object.fromEntries((Object.keys(typographyFallback) as BookTextRole[]).map((role) => [role, textStyle(sourceTypography[role], typographyFallback[role])])) as BookTypography,
    paragraphStyles: paragraphStyles(source.paragraphStyles),
  };
}

export function serializeBookLayout(layout: BookLayout) {
  return JSON.stringify(layout);
}

export function layoutForBook(book: Book) {
  const typographyFallback = Object.fromEntries((Object.keys(DEFAULT_BOOK_TYPOGRAPHY) as BookTextRole[]).map((role) => [role, { ...DEFAULT_BOOK_TYPOGRAPHY[role], fontFamily: book.font_family, fontSize: book.font_size, lineHeight: book.line_height }])) as BookTypography;
  const margin = Number.isFinite(book.margin) ? Math.min(3, Math.max(0.2, book.margin)) : 1;
  const marginsFallback: BookPageMargins = { top: margin, right: margin, bottom: margin, left: margin };
  return parseBookLayout(book.layout_json, typographyFallback, marginsFallback);
}

export function pageRuleFor(layout: BookLayout, key: string): BookPageNumberRule {
  const numbering = layout.pageNumbering;
  return numbering.rules[key] ?? {
    enabled: numbering.enabled,
    style: numbering.style,
    start: numbering.start,
    customFormat: numbering.customFormat,
  };
}

export function pageNumberForSection(layout: BookLayout, key: string, section: BookPageStartSection, ordinal: number) {
  const hasOverride = Boolean(layout.pageNumbering.rules[key]);
  const order: Record<BookPageStartSection, number> = { opening: 0, contents: 1, story: 2, closing: 3 };
  if (!hasOverride && order[section] < order[layout.pageNumbering.startSection]) return null;
  const rule = pageRuleFor(layout, key);
  if (!rule.enabled) return null;
  return pageNumberText(rule.start + Math.max(0, ordinal), rule.style, rule.customFormat);
}

export function pageNumberText(value: number, style: BookPageNumberStyle, customFormat: string) {
  const safeValue = Math.max(1, Math.round(value));
  if (style === "arabic") return String(safeValue);
  if (style === "custom") return customFormat.replace(/\{n\}/g, String(safeValue));
  let remainder = safeValue;
  const numerals = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]] as const;
  let roman = "";
  for (const [unit, numeral] of numerals) {
    while (remainder >= unit) {
      roman += numeral;
      remainder -= unit;
    }
  }
  return style === "roman-lower" ? roman.toLocaleLowerCase() : roman;
}

export function layoutSectionKey(kind: "opening" | "contents" | "story" | "closing", id?: number) {
  return id === undefined ? kind : `${kind}:${id}`;
}

export function layoutTokenText(value: string, book: Book, section: string, pageNumber: string) {
  return value
    .replace(/\{\{title\}\}/gi, book.title || "Untitled manuscript")
    .replace(/\{\{author\}\}/gi, book.author || "")
    .replace(/\{\{section\}\}/gi, section)
    .replace(/\{\{page\}\}/gi, pageNumber);
}
