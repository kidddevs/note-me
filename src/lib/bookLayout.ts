import type { Book } from "./types";

export type BookChromePosition = "left" | "center" | "right";
export type BookPageNumberStyle = "arabic" | "roman-lower" | "roman-upper" | "custom";
export type BookPageStartSection = "opening" | "contents" | "story" | "closing";
export type BookTextAlign = "left" | "center" | "right" | "justify";
export type BookTextFontStyle = "normal" | "italic";
export type BookNestedStyle = "none" | "small-caps" | "bold" | "italic" | "accent";
export type BookTextRole = "title" | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6" | "paragraph" | "quote";

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
}

export type BookTypography = Record<BookTextRole, BookTextStyle>;

export interface BookLayout {
  header: BookChrome;
  footer: BookChrome;
  pageNumbering: BookPageNumbering;
  typography: BookTypography;
}

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
  typography: DEFAULT_BOOK_TYPOGRAPHY,
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
  };
}

export function parseBookLayout(value?: string, typographyFallback: BookTypography = DEFAULT_BOOK_TYPOGRAPHY): BookLayout {
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
    typography: Object.fromEntries((Object.keys(typographyFallback) as BookTextRole[]).map((role) => [role, textStyle(sourceTypography[role], typographyFallback[role])])) as BookTypography,
  };
}

export function serializeBookLayout(layout: BookLayout) {
  return JSON.stringify(layout);
}

export function layoutForBook(book: Book) {
  const typographyFallback = Object.fromEntries((Object.keys(DEFAULT_BOOK_TYPOGRAPHY) as BookTextRole[]).map((role) => [role, { ...DEFAULT_BOOK_TYPOGRAPHY[role], fontFamily: book.font_family, fontSize: book.font_size, lineHeight: book.line_height }])) as BookTypography;
  return parseBookLayout(book.layout_json, typographyFallback);
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
