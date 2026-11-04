import type { Book, Chapter } from "./types";
import type { BookCoverDesign, BookCoverGradient } from "./bookLayout";
import { BOOK_GRAPHICS, graphicDataUri } from "./bookAssets";

/* ==========================================================================
   Layered cover document
   A full print wrap is built from independently transformable layers. Every
   layer lives in inches on its own panel (front, back, spine) or across the
   whole wrap. That keeps front/back layouts stable when the spine grows.
   ========================================================================== */

export type CoverPanel = "front" | "back" | "spine" | "wrap";
export type CoverLayerType = "text" | "image" | "shape" | "line" | "symbol" | "artwork" | "barcode";
export type CoverTextAlign = "left" | "center" | "right" | "justify";
export type CoverVerticalAlign = "top" | "middle" | "bottom";
export type CoverTextEffect = "none" | "soft" | "hard" | "glow" | "outline";
export type CoverShapeKind = "rectangle" | "ellipse" | "triangle" | "diamond" | "star" | "burst" | "heart" | "arch" | "octagon" | "shield" | "ticket" | "banner" | "leaf" | "arrow";
export type CoverDashStyle = "solid" | "dashed" | "dotted";
export type CoverBlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light" | "color-dodge" | "color-burn" | "darken" | "lighten" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";
export type CoverFontId = "serif" | "display" | "sans" | "condensed" | "mono" | "humanist" | "script" | "slab" | "baskerville" | "garamond" | "avenir" | "futura" | "optima" | "copperplate" | "typewriter" | "hoefler" | "iowan" | "charter" | "bodoni" | "gill" | "avenir-next" | "menlo" | "bradley";
export type CoverFillType = "solid" | "gradient" | "pattern" | "none";
export type CoverPatternId = "dots" | "stripes" | "grid" | "checks" | "waves" | "crosshatch" | "diagonal" | "confetti";
export type CoverImageMask = "none" | "circle" | "arch" | "diamond" | "hexagon";

export interface CoverFillStop {
  color: string;
  position: number;
}

export interface CoverPattern {
  type: CoverPatternId;
  color: string;
  background: string;
  scale: number;
  angle: number;
}

export interface CoverFill {
  type: CoverFillType;
  color: string;
  gradient: BookCoverGradient;
  pattern?: CoverPattern;
}

export interface CoverLayerShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface CoverLayerGlow {
  enabled: boolean;
  color: string;
  blur: number;
  opacity: number;
}

export type CoverLayerFadeMode = "none" | "bottom" | "top" | "left" | "right" | "vignette";

export interface CoverLayerFade {
  mode: CoverLayerFadeMode;
  size: number;
}

export interface CoverLayerBase {
  id: string;
  type: CoverLayerType;
  name: string;
  panel: CoverPanel;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  blendMode: CoverBlendMode;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
  shadow: CoverLayerShadow;
  glow: CoverLayerGlow;
  fade: CoverLayerFade;
}

export interface CoverLayerGroup {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
}

export interface CoverTextHighlight {
  enabled: boolean;
  color: string;
  opacity: number;
  padding: number;
  radius: number;
}

export interface CoverTextLayer extends CoverLayerBase {
  type: "text";
  text: string;
  fontFamily: CoverFontId;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  align: CoverTextAlign;
  verticalAlign: CoverVerticalAlign;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  uppercase: boolean;
  effect: CoverTextEffect;
  effectColor: string;
  curve: number;
  customFont: string;
  highlight: CoverTextHighlight;
}

export interface CoverImageLayer extends CoverLayerBase {
  type: "image";
  src: string;
  sourceWidth: number;
  sourceHeight: number;
  fit: "cover" | "contain";
  radius: number;
  grayscale: boolean;
  sepia: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  tint: string;
  tintStrength: number;
  mask: CoverImageMask;
  focusX: number;
  focusY: number;
  flipX: boolean;
  flipY: boolean;
}

export interface CoverShapeLayer extends CoverLayerBase {
  type: "shape";
  shape: CoverShapeKind;
  fill: CoverFill;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
  dash: CoverDashStyle;
}

export interface CoverLineLayer extends CoverLayerBase {
  type: "line";
  color: string;
  dash: CoverDashStyle;
}

export interface CoverSymbolLayer extends CoverLayerBase {
  type: "symbol";
  glyph: string;
  color: string;
}

export interface CoverArtworkLayer extends CoverLayerBase {
  type: "artwork";
  graphicId: string;
  color: string;
}

export interface CoverBarcodeLayer extends CoverLayerBase {
  type: "barcode";
  showText: boolean;
  barColor: string;
  background: string;
}

export type CoverLayer = CoverTextLayer | CoverImageLayer | CoverShapeLayer | CoverLineLayer | CoverSymbolLayer | CoverArtworkLayer | CoverBarcodeLayer;

export interface CoverGuideline {
  id: string;
  axis: "x" | "y";
  panel: CoverPanel;
  position: number;
}

export interface BookCoverDocument {
  version: 1;
  templateId: string;
  background: CoverFill;
  layers: CoverLayer[];
  groups: CoverLayerGroup[];
  palette: string[];
  guides: CoverGuideline[];
  showGuides: boolean;
  showGrid: boolean;
  showBleed: boolean;
  showRulers: boolean;
}

export interface CoverMetrics {
  trimWidth: number;
  trimHeight: number;
  spineWidth: number;
  bleed: number;
  fullWidth: number;
  fullHeight: number;
  trimWidthTotal: number;
  panelWidths: Record<Exclude<CoverPanel, "wrap">, number>;
  panelOrigins: Record<Exclude<CoverPanel, "wrap">, { x: number; y: number }>;
}

export interface CoverPanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverPaperStock {
  id: string;
  label: string;
  description: string;
  thickness: number;
}

export const COVER_PAPER_STOCKS: CoverPaperStock[] = [
  { id: "cream-60", label: "Cream 60#", description: "Warm trade paperback stock", thickness: 0.0025 },
  { id: "white-60", label: "White 60#", description: "Standard white book stock", thickness: 0.002252 },
  { id: "premium-color", label: "Premium color", description: "Premium colour on white", thickness: 0.002347 },
  { id: "standard-color", label: "Standard color", description: "Standard colour on white", thickness: 0.002252 },
];

export const COVER_MIN_SPINE = 0.0625;

export const COVER_FONTS: { id: CoverFontId; label: string; css: string; group: string }[] = [
  { id: "serif", label: "Georgia", css: "Georgia, 'Times New Roman', serif", group: "Serif" },
  { id: "display", label: "Didot", css: "Didot, 'Bodoni 72', 'Times New Roman', serif", group: "Display" },
  { id: "humanist", label: "Palatino", css: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif", group: "Serif" },
  { id: "slab", label: "Rockwell", css: "Rockwell, 'Courier New', Georgia, serif", group: "Display" },
  { id: "sans", label: "Helvetica", css: "'Helvetica Neue', Helvetica, Arial, sans-serif", group: "Sans" },
  { id: "condensed", label: "Condensed", css: "'Arial Narrow', 'Helvetica Neue Condensed', 'Helvetica Neue', sans-serif", group: "Sans" },
  { id: "mono", label: "Courier", css: "'Courier New', 'SF Mono', monospace", group: "Mono" },
  { id: "script", label: "Snell", css: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive", group: "Script" },
  { id: "baskerville", label: "Baskerville", css: "Baskerville, 'Baskerville Old Face', 'Libre Baskerville', Georgia, serif", group: "Serif" },
  { id: "garamond", label: "Garamond", css: "Garamond, 'EB Garamond', 'Adobe Garamond Pro', Georgia, serif", group: "Serif" },
  { id: "avenir", label: "Avenir", css: "Avenir, 'Avenir Next', 'Helvetica Neue', sans-serif", group: "Sans" },
  { id: "futura", label: "Futura", css: "Futura, 'Futura PT', 'Avenir Next Condensed', sans-serif", group: "Sans" },
  { id: "optima", label: "Optima", css: "Optima, Candara, 'Gill Sans', sans-serif", group: "Sans" },
  { id: "copperplate", label: "Copperplate", css: "Copperplate, 'Copperplate Gothic Light', Georgia, serif", group: "Display" },
  { id: "typewriter", label: "Typewriter", css: "'American Typewriter', 'Courier New', monospace", group: "Mono" },
  { id: "hoefler", label: "Hoefler Text", css: "'Hoefler Text', Baskerville, Georgia, serif", group: "Serif" },
  { id: "iowan", label: "Iowan Old Style", css: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif", group: "Serif" },
  { id: "charter", label: "Charter", css: "Charter, 'Bitstream Charter', Georgia, serif", group: "Serif" },
  { id: "bodoni", label: "Bodoni 72", css: "'Bodoni 72', Didot, 'Times New Roman', serif", group: "Display" },
  { id: "gill", label: "Gill Sans", css: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif", group: "Sans" },
  { id: "avenir-next", label: "Avenir Next", css: "'Avenir Next', Avenir, 'Helvetica Neue', sans-serif", group: "Sans" },
  { id: "menlo", label: "Menlo", css: "Menlo, Monaco, 'SF Mono', Consolas, monospace", group: "Mono" },
  { id: "bradley", label: "Bradley Hand", css: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive", group: "Script" },
];

export const COVER_SYMBOLS: string[] = [
  "✦", "✧", "★", "☆", "❖", "❧", "☙", "✺", "✵", "❀", "❁", "❦",
  "☾", "☀", "⚜", "♛", "♞", "⚓", "✒", "⌘", "∞", "§", "¶", "†",
  "‡", "•", "—", "❝", "❞", "✈", "☕", "♥", "♦", "♠", "♣", "✚",
  "☂", "☁", "⚙", "⚡", "✉", "✎", "✏", "✂", "☘", "✿", "❋", "❊",
  "✤", "✥", "✱", "➤", "♪", "♫", "☯", "☮", "♨", "⚑", "⚐", "⌛",
];

export interface CoverImagePreset {
  id: string;
  label: string;
  description: string;
  patch: Partial<CoverImageLayer>;
}

export const COVER_IMAGE_PRESETS: CoverImagePreset[] = [
  { id: "original", label: "Original", description: "No grading", patch: { grayscale: false, sepia: false, brightness: 100, contrast: 100, saturation: 100, hue: 0, tintStrength: 0 } },
  { id: "warm", label: "Warm film", description: "Golden highlights", patch: { grayscale: false, sepia: false, brightness: 103, contrast: 104, saturation: 108, hue: 0, tint: "#e6a25e", tintStrength: 0.18 } },
  { id: "cool", label: "Cool editorial", description: "Blue shadows", patch: { grayscale: false, sepia: false, brightness: 100, contrast: 106, saturation: 92, hue: -6, tint: "#5f8fbf", tintStrength: 0.22 } },
  { id: "mono", label: "Mono", description: "Clean black & white", patch: { grayscale: true, sepia: false, brightness: 104, contrast: 112, saturation: 100, hue: 0, tintStrength: 0 } },
  { id: "duotone", label: "Duotone", description: "Two-ink poster", patch: { grayscale: true, sepia: false, brightness: 106, contrast: 118, saturation: 100, hue: 0, tint: "#c96b3b", tintStrength: 0.62 } },
  { id: "fade", label: "Faded", description: "Soft matte print", patch: { grayscale: false, sepia: true, brightness: 108, contrast: 86, saturation: 82, hue: 0, tint: "#d8b98f", tintStrength: 0.12 } },
  { id: "noir", label: "Noir", description: "Deep contrast", patch: { grayscale: true, sepia: false, brightness: 90, contrast: 132, saturation: 100, hue: 0, tintStrength: 0 } },
];

export function coverImageFilterCss(layer: Pick<CoverImageLayer, "grayscale" | "sepia" | "brightness" | "contrast" | "saturation" | "hue" | "blur">) {
  return [
    layer.grayscale ? "grayscale(1)" : "",
    layer.sepia ? "sepia(0.72)" : "",
    layer.brightness !== 100 ? `brightness(${layer.brightness}%)` : "",
    layer.contrast !== 100 ? `contrast(${layer.contrast}%)` : "",
    layer.saturation !== 100 ? `saturate(${layer.saturation}%)` : "",
    layer.hue !== 0 ? `hue-rotate(${layer.hue}deg)` : "",
    layer.blur > 0 ? `blur(${roundInches(layer.blur * 96)}px)` : "",
  ].filter(Boolean).join(" ");
}

export function coverImageFilterCanvas(layer: Pick<CoverImageLayer, "grayscale" | "sepia" | "brightness" | "contrast" | "saturation" | "hue" | "blur">, dpi: number) {
  return [
    layer.grayscale ? "grayscale(1)" : "",
    layer.sepia ? "sepia(0.72)" : "",
    layer.brightness !== 100 ? `brightness(${layer.brightness}%)` : "",
    layer.contrast !== 100 ? `contrast(${layer.contrast}%)` : "",
    layer.saturation !== 100 ? `saturate(${layer.saturation}%)` : "",
    layer.hue !== 0 ? `hue-rotate(${layer.hue}deg)` : "",
    layer.blur > 0 ? `blur(${Math.max(0.2, roundInches(layer.blur * dpi))}px)` : "",
  ].filter(Boolean).join(" ");
}

export interface CoverImageOverflow {
  x: number;
  y: number;
}

/** Oversized image area in inches that can be panned inside a filled frame. */
export function coverImageOverflow(layer: Pick<CoverImageLayer, "width" | "height" | "fit">, imageWidth: number, imageHeight: number): CoverImageOverflow {
  if (layer.fit !== "cover" || !(imageWidth > 0) || !(imageHeight > 0) || layer.width <= 0 || layer.height <= 0) return { x: 0, y: 0 };
  const scale = Math.max(layer.width / imageWidth, layer.height / imageHeight);
  return {
    x: Math.max(0, imageWidth * scale - layer.width),
    y: Math.max(0, imageHeight * scale - layer.height),
  };
}

/** Converts an in-frame drag into object-position focus, clamped to the photo edges. */
export function panCoverImageFocus(focusX: number, focusY: number, deltaX: number, deltaY: number, overflow: CoverImageOverflow) {
  return {
    focusX: overflow.x > 0.0001 ? Math.round(clamp(focusX - deltaX / overflow.x, 0, 1) * 1000) / 1000 : Math.round(clamp(focusX, 0, 1) * 1000) / 1000,
    focusY: overflow.y > 0.0001 ? Math.round(clamp(focusY - deltaY / overflow.y, 0, 1) * 1000) / 1000 : Math.round(clamp(focusY, 0, 1) * 1000) / 1000,
  };
}

export function coverImageMaskCss(mask: CoverImageMask) {
  if (mask === "circle") return "border-radius:50%;";
  if (mask === "arch") return "border-radius:50% 50% 0 0 / 34% 34% 0 0;";
  if (mask === "diamond") return "clip-path:polygon(50% 0, 100% 50%, 50% 100%, 0 50%);";
  if (mask === "hexagon") return "clip-path:polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);";
  return "";
}

export interface CoverTemplatePreset {
  id: string;
  label: string;
  description: string;
  mood: string;
  palette: [string, string, string];
}

export const COVER_TEMPLATE_PRESETS: CoverTemplatePreset[] = [
  { id: "atelier", label: "Editorial Atelier", description: "Warm paper, a literary display title and a restrained back cover.", mood: "Literary", palette: ["#f5efe4", "#2a211b", "#a56b3e"] },
  { id: "noir", label: "Midnight Noir", description: "Deep ink, metallic type and a cinematic back cover.", mood: "Thriller", palette: ["#14161a", "#f4efe6", "#c9a227"] },
  { id: "photo", label: "Cinematic Photo", description: "A full-bleed wrap image with legible overlays and a clean barcode.", mood: "Commercial", palette: ["#344e5a", "#f8f4ed", "#e7c37a"] },
  { id: "minimal", label: "Modern Minimal", description: "Quiet white space and confident typographic hierarchy.", mood: "Contemporary", palette: ["#fbfaf7", "#111111", "#d64b32"] },
  { id: "heritage", label: "Heritage Classic", description: "Deep green, gold rules and a timeless centred composition.", mood: "Classic", palette: ["#1f3a2d", "#f0e6d1", "#c6a15b"] },
  { id: "bold", label: "Bold Colour", description: "A punchy colour block with oversized type and a bold spine.", mood: "Commercial", palette: ["#e4583a", "#fff7ec", "#1a1613"] },
];

export interface CoverDocSeedOptions {
  pageCount?: number;
  accentColor?: string;
}

const DEFAULT_TEXT_COLOR = "#211b16";
const DEFAULT_ACCENT = "#a56b3e";

const LAYER_TYPES: CoverLayerType[] = ["text", "image", "shape", "line", "symbol", "artwork", "barcode"];
const PANELS: CoverPanel[] = ["front", "back", "spine", "wrap"];
const FONT_IDS = COVER_FONTS.map((font) => font.id);
const BLEND_MODES: CoverBlendMode[] = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "color-dodge", "color-burn", "darken", "lighten", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
const SHAPES: CoverShapeKind[] = ["rectangle", "ellipse", "triangle", "diamond", "star", "burst", "heart", "arch", "octagon", "shield", "ticket", "banner", "leaf", "arrow"];
const DASH_STYLES: CoverDashStyle[] = ["solid", "dashed", "dotted"];
const IMAGE_MASKS: CoverImageMask[] = ["none", "circle", "arch", "diamond", "hexagon"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function decimal(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback;
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), minimum, maximum) : fallback;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, fallback = "", max = 4000) {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function oneOf<T extends string>(value: unknown, options: T[], fallback: T): T {
  return options.includes(value as T) ? value as T : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

export function roundInches(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function coverFontCss(id: CoverFontId, customFont = "") {
  const custom = customFont.replace(/[<>{};\\"'`]/g, "").trim();
  if (custom) return `'${custom}', Georgia, serif`;
  return COVER_FONTS.find((font) => font.id === id)?.css ?? COVER_FONTS[0].css;
}

export function coverPaperStock(id: string) {
  return COVER_PAPER_STOCKS.find((stock) => stock.id === id) ?? COVER_PAPER_STOCKS[0];
}

export function spineWidthForPages(pageCount: number, paperStockId: string, override = 0) {
  if (override > 0) return roundInches(override);
  const pages = clamp(Math.round(pageCount), 1, 8000);
  return Math.max(COVER_MIN_SPINE, roundInches(pages * coverPaperStock(paperStockId).thickness));
}

export function spineWidthMillimetres(spineWidth: number) {
  return Math.round(spineWidth * 25.4 * 10) / 10;
}

export function coverTrimSize(trimSize: string): { width: number; height: number } {
  const [width, height] = (trimSize || "6x9").split("x").map((part) => Number.parseFloat(part));
  return {
    width: Number.isFinite(width) && width > 0 ? width : 6,
    height: Number.isFinite(height) && height > 0 ? height : 9,
  };
}

export function coverMetrics(trimSize: string, cover: Pick<BookCoverDesign, "pageCount" | "paperStock" | "spineWidthOverride" | "bleed">): CoverMetrics {
  const trim = coverTrimSize(trimSize);
  const spineWidth = spineWidthForPages(cover.pageCount, cover.paperStock, cover.spineWidthOverride);
  const bleed = clamp(Number.isFinite(cover.bleed) ? cover.bleed : 0.125, 0, 0.5);
  const trimWidthTotal = trim.width * 2 + spineWidth;
  const fullWidth = trimWidthTotal + bleed * 2;
  const fullHeight = trim.height + bleed * 2;
  return {
    trimWidth: trim.width,
    trimHeight: trim.height,
    spineWidth,
    bleed,
    fullWidth: roundInches(fullWidth),
    fullHeight: roundInches(fullHeight),
    trimWidthTotal: roundInches(trimWidthTotal),
    panelWidths: { back: trim.width, spine: spineWidth, front: trim.width },
    panelOrigins: {
      back: { x: bleed, y: bleed },
      spine: { x: bleed + trim.width, y: bleed },
      front: { x: bleed + trim.width + spineWidth, y: bleed },
    },
  };
}

export function coverPanelRect(metrics: CoverMetrics, panel: CoverPanel): CoverPanelRect {
  if (panel === "wrap") return { x: 0, y: 0, width: metrics.fullWidth, height: metrics.fullHeight };
  const origin = metrics.panelOrigins[panel];
  return { x: origin.x, y: origin.y, width: metrics.panelWidths[panel], height: metrics.trimHeight };
}

export function coverPanels(): { id: Exclude<CoverPanel, "wrap">; label: string; description: string }[] {
  return [
    { id: "front", label: "Front cover", description: "The face of the book" },
    { id: "spine", label: "Spine", description: "Calculated from your page count" },
    { id: "back", label: "Back cover", description: "Blurb, author, and barcode" },
  ];
}

export function coverPattern(colorValue = DEFAULT_ACCENT, background = "#f5efe4"): CoverPattern {
  return { type: "dots", color: shadeColor(colorValue, -0.18), background, scale: 0.5, angle: 0 };
}

export function coverFill(colorValue = DEFAULT_ACCENT): CoverFill {
  return {
    type: "solid",
    color: colorValue,
    gradient: { type: "linear", angle: 135, stops: [{ color: colorValue, position: 0 }, { color: shadeColor(colorValue, -0.28), position: 1 }] },
    pattern: coverPattern(colorValue, colorValue),
  };
}

export function noCoverFill(): CoverFill {
  return { type: "none", color: "transparent", gradient: { type: "linear", angle: 90, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] }, pattern: coverPattern(DEFAULT_ACCENT, "#ffffff") };
}

export function emptyCoverDocument(): BookCoverDocument {
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "",
    background: coverFill("#f5efe4"),
    layers: [],
    guides: [],
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

export function hasCoverDocument(cover: BookCoverDesign) {
  return Boolean(cover.doc && (cover.doc.layers.length > 0 || cover.doc.templateId !== ""));
}

export function newCoverLayerId(prefix = "layer") {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
}

function cloneFill(fill: CoverFill): CoverFill {
  return {
    ...fill,
    gradient: {
      ...fill.gradient,
      stops: fill.gradient.stops.map((stop) => ({ ...stop })),
    },
  };
}

/** Copies layers with fresh ids, staggered positions, and optional group remapping. */
export function cloneCoverLayers(layers: CoverLayer[], options: { offsetX?: number; offsetY?: number; stagger?: number; suffix?: string; groupId?: string | null } = {}): CoverLayer[] {
  const offsetX = options.offsetX ?? 0.12;
  const offsetY = options.offsetY ?? 0.12;
  const stagger = options.stagger ?? 0.03;
  return layers.map((layer, index) => {
    const clone = {
      ...(layer.type === "shape" ? { ...layer, fill: cloneFill(layer.fill) } : { ...layer }),
      id: newCoverLayerId(layer.type),
      name: `${layer.name}${options.suffix ?? " copy"}`,
      x: roundInches(layer.x + offsetX + index * stagger),
      y: roundInches(layer.y + offsetY + index * stagger),
      groupId: options.groupId !== undefined ? options.groupId : layer.groupId,
    } as CoverLayer;
    return clone;
  });
}

/* ------------------------------------------------------------------ fills */

export function shadeColor(value: string, amount: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return value;
  const number = Number.parseInt(match[1], 16);
  const channels = [number >> 16, (number >> 8) & 0xff, number & 0xff].map((channel) => {
    const next = amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount;
    return clamp(Math.round(next), 0, 255);
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export const COVER_GRADIENT_PRESETS: { id: string; label: string; gradient: BookCoverGradient }[] = [
  { id: "paper", label: "Warm paper", gradient: { type: "linear", angle: 135, stops: [{ color: "#f5efe4", position: 0 }, { color: "#d8c7ae", position: 1 }] } },
  { id: "ink", label: "Deep ink", gradient: { type: "linear", angle: 155, stops: [{ color: "#14161a", position: 0 }, { color: "#3b3f46", position: 1 }] } },
  { id: "sunset", label: "Terracotta", gradient: { type: "linear", angle: 135, stops: [{ color: "#e4583a", position: 0 }, { color: "#f2c6a0", position: 1 }] } },
  { id: "forest", label: "Forest", gradient: { type: "linear", angle: 160, stops: [{ color: "#1f3a2d", position: 0 }, { color: "#6b8f6a", position: 1 }] } },
  { id: "gold", label: "Antique gold", gradient: { type: "linear", angle: 135, stops: [{ color: "#c9a227", position: 0 }, { color: "#7a5d1e", position: 1 }] } },
  { id: "halo", label: "Warm halo", gradient: { type: "radial", angle: 90, stops: [{ color: "#f2e6c9", position: 0 }, { color: "#a56b3e", position: 1 }] } },
];

export function reverseCoverGradient(gradient: BookCoverGradient): BookCoverGradient {
  return {
    ...gradient,
    stops: gradient.stops
      .map((stop) => ({ ...stop, position: Math.round((1 - stop.position) * 1000) / 1000 }))
      .sort((a, b) => a.position - b.position),
  };
}

export function coverGradientCss(gradient: BookCoverGradient) {
  const stops = gradient.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${stop.color} ${Math.round(stop.position * 1000) / 10}%`)
    .join(", ");
  if (gradient.type === "radial") return `radial-gradient(circle at 50% 50%, ${stops})`;
  return `linear-gradient(${Math.round(gradient.angle)}deg, ${stops})`;
}

function patternTileContent(pattern: CoverPattern) {
  const ink = pattern.color;
  if (pattern.type === "stripes") return `<rect width="18" height="100" fill="${ink}"/><rect x="50" width="18" height="100" fill="${ink}"/>`;
  if (pattern.type === "grid") return `<path d="M25 0V100M75 0V100M0 25H100M0 75H100" stroke="${ink}" stroke-width="2.5" fill="none"/>`;
  if (pattern.type === "checks") return `<rect width="50" height="50" fill="${ink}"/><rect x="50" y="50" width="50" height="50" fill="${ink}"/>`;
  if (pattern.type === "waves") return `<path d="M0 35 Q25 10 50 35 T100 35" fill="none" stroke="${ink}" stroke-width="7"/><path d="M0 75 Q25 50 50 75 T100 75" fill="none" stroke="${ink}" stroke-width="7" opacity=".55"/>`;
  if (pattern.type === "crosshatch") return `<path d="M0 100 L100 0 M-50 50 L50 -50 M50 150 L150 50" stroke="${ink}" stroke-width="3"/><path d="M0 0 L100 100 M-50 50 L50 150 M50 -50 L150 50" stroke="${ink}" stroke-width="3" opacity=".7"/>`;
  if (pattern.type === "diagonal") return `<path d="M0 100 L100 0 M-50 50 L50 -50 M50 150 L150 50" stroke="${ink}" stroke-width="7"/>`;
  if (pattern.type === "confetti") return `<circle cx="18" cy="22" r="5" fill="${ink}"/><circle cx="72" cy="16" r="3" fill="${ink}" opacity=".65"/><rect x="62" y="62" width="9" height="9" fill="${ink}" transform="rotate(18 66 66)"/><circle cx="28" cy="76" r="4" fill="${ink}" opacity=".8"/><path d="M84 42 l7 4 -6 5z" fill="${ink}" opacity=".55"/>`;
  return `<circle cx="25" cy="25" r="7" fill="${ink}"/><circle cx="75" cy="75" r="7" fill="${ink}"/>`;
}

export function coverPatternDataUrl(pattern: CoverPattern) {
  const tile = Math.max(8, Math.round(pattern.scale * 96));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 100 100"><rect width="100" height="100" fill="${pattern.background}"/><g transform="rotate(${pattern.angle} 50 50)">${patternTileContent(pattern)}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function coverFillCss(fill: CoverFill) {
  if (fill.type === "none") return "transparent";
  if (fill.type === "solid") return fill.color;
  if (fill.type === "pattern") {
    const pattern = fill.pattern ?? coverPattern(fill.color);
    return `${pattern.background} url("${coverPatternDataUrl(pattern)}") repeat`;
  }
  return coverGradientCss(fill.gradient);
}

export function coverFillMarkup(fill: CoverFill) {
  return coverFillCss(fill);
}

/* ------------------------------------------------------------ normalization */

function normalizeGradient(value: unknown, fallback: BookCoverGradient): BookCoverGradient {
  const source = isRecord(value) ? value : {};
  const type = source.type === "radial" ? "radial" : "linear";
  const angle = decimal(source.angle, fallback.angle, 0, 360);
  const rawStops = Array.isArray(source.stops) ? source.stops.filter(isRecord) : [];
  const stops = rawStops.slice(0, 5).map((stop, index) => ({
    color: color(stop.color, fallback.stops[index % fallback.stops.length]?.color ?? "#000000"),
    position: decimal(stop.position, index === 0 ? 0 : 1, 0, 1),
  }));
  return {
    type,
    angle,
    stops: stops.length >= 2 ? stops : fallback.stops.map((stop) => ({ ...stop })),
  };
}

function normalizePattern(value: unknown, fallback: CoverPattern): CoverPattern {
  const source = isRecord(value) ? value : {};
  return {
    type: oneOf(source.type, ["dots", "stripes", "grid", "checks", "waves", "crosshatch", "diagonal", "confetti"] as const, fallback.type),
    color: color(source.color, fallback.color),
    background: color(source.background, fallback.background),
    scale: decimal(source.scale, fallback.scale, 0.08, 2),
    angle: decimal(source.angle, fallback.angle, 0, 360),
  };
}

function normalizeFill(value: unknown, fallback: CoverFill): CoverFill {
  const source = isRecord(value) ? value : {};
  return {
    type: oneOf(source.type, ["solid", "gradient", "pattern", "none"] as const, fallback.type),
    color: color(source.color, fallback.color),
    gradient: normalizeGradient(source.gradient, fallback.gradient),
    pattern: normalizePattern(source.pattern, fallback.pattern ?? coverPattern()),
  };
}

function gradientMeta(gradient: BookCoverGradient) {
  const radians = ((gradient.angle - 90) * Math.PI) / 180;
  return {
    x1: 0.5 - Math.cos(radians) * 0.5,
    y1: 0.5 - Math.sin(radians) * 0.5,
    x2: 0.5 + Math.cos(radians) * 0.5,
    y2: 0.5 + Math.sin(radians) * 0.5,
  };
}

/* ---------------------------------------------------------------- layers */

function baseLayer(input: Omit<CoverLayerBase, "type" | "rotation" | "opacity" | "blendMode" | "visible" | "locked" | "groupId" | "shadow" | "glow" | "fade"> & Partial<Pick<CoverLayerBase, "rotation" | "opacity" | "blendMode" | "visible" | "locked" | "groupId" | "shadow" | "glow" | "fade">>): Omit<CoverLayerBase, "type"> {
  return {
    id: input.id,
    name: input.name,
    panel: input.panel,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    blendMode: input.blendMode ?? "normal",
    visible: input.visible ?? true,
    locked: input.locked ?? false,
    groupId: input.groupId ?? null,
    shadow: input.shadow ?? { enabled: false, color: "#000000", blur: 0.16, offsetX: 0.04, offsetY: 0.06, opacity: 0.35 },
    glow: input.glow ?? { enabled: false, color: "#c9a227", blur: 0.22, opacity: 0.4 },
    fade: input.fade ?? { mode: "none", size: 0.35 },
  };
}

export function textLayer(input: Partial<CoverTextLayer> & Pick<CoverTextLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height" | "text">): CoverTextLayer {
  return {
    type: "text",
    ...baseLayer(input),
    text: input.text,
    fontFamily: input.fontFamily ?? "serif",
    fontSize: input.fontSize ?? 12,
    fontWeight: input.fontWeight ?? 400,
    italic: input.italic ?? false,
    align: input.align ?? "left",
    verticalAlign: input.verticalAlign ?? "top",
    lineHeight: input.lineHeight ?? 1.3,
    letterSpacing: input.letterSpacing ?? 0,
    color: input.color ?? DEFAULT_TEXT_COLOR,
    uppercase: input.uppercase ?? false,
    effect: input.effect ?? "none",
    effectColor: input.effectColor ?? "#000000",
    curve: input.curve ?? 0,
    customFont: input.customFont ?? "",
    highlight: input.highlight ?? { enabled: false, color: "#f2c6a0", opacity: 0.65, padding: 0.04, radius: 0.02 },
  };
}

export function imageLayer(input: Partial<CoverImageLayer> & Pick<CoverImageLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height" | "src">): CoverImageLayer {
  return {
    type: "image",
    ...baseLayer(input),
    src: input.src,
    sourceWidth: input.sourceWidth ?? 0,
    sourceHeight: input.sourceHeight ?? 0,
    fit: input.fit ?? "cover",
    radius: input.radius ?? 0,
    grayscale: input.grayscale ?? false,
    sepia: input.sepia ?? false,
    brightness: input.brightness ?? 100,
    contrast: input.contrast ?? 100,
    saturation: input.saturation ?? 100,
    hue: input.hue ?? 0,
    blur: input.blur ?? 0,
    tint: input.tint ?? "#ffffff",
    tintStrength: input.tintStrength ?? 0,
    mask: input.mask ?? "none",
    focusX: input.focusX ?? 0.5,
    focusY: input.focusY ?? 0.5,
    flipX: input.flipX ?? false,
    flipY: input.flipY ?? false,
  };
}

export function shapeLayer(input: Partial<CoverShapeLayer> & Pick<CoverShapeLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height" | "shape">): CoverShapeLayer {
  return {
    type: "shape",
    ...baseLayer(input),
    shape: input.shape,
    fill: input.fill ?? coverFill(DEFAULT_ACCENT),
    radius: input.radius ?? 0,
    strokeColor: input.strokeColor ?? "#000000",
    strokeWidth: input.strokeWidth ?? 0,
    dash: input.dash ?? "solid",
  };
}

export function lineLayer(input: Partial<CoverLineLayer> & Pick<CoverLineLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height">): CoverLineLayer {
  return {
    type: "line",
    ...baseLayer(input),
    color: input.color ?? DEFAULT_ACCENT,
    dash: input.dash ?? "solid",
  };
}

export function symbolLayer(input: Partial<CoverSymbolLayer> & Pick<CoverSymbolLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height" | "glyph">): CoverSymbolLayer {
  return {
    type: "symbol",
    ...baseLayer(input),
    glyph: input.glyph,
    color: input.color ?? DEFAULT_ACCENT,
  };
}

export function artworkLayer(input: Partial<CoverArtworkLayer> & Pick<CoverArtworkLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height" | "graphicId">): CoverArtworkLayer {
  return {
    type: "artwork",
    ...baseLayer(input),
    graphicId: input.graphicId,
    color: input.color ?? DEFAULT_ACCENT,
  };
}

export function coverGraphic(graphicId: string) {
  return BOOK_GRAPHICS.find((graphic) => graphic.id === graphicId) ?? BOOK_GRAPHICS[0];
}

export function coverArtworkDataUrl(layer: CoverArtworkLayer) {
  const graphic = coverGraphic(layer.graphicId);
  return graphicDataUri(graphic.svg, layer.color);
}

export function barcodeLayer(input: Partial<CoverBarcodeLayer> & Pick<CoverBarcodeLayer, "id" | "name" | "panel" | "x" | "y" | "width" | "height">): CoverBarcodeLayer {
  return {
    type: "barcode",
    ...baseLayer(input),
    showText: input.showText ?? true,
    barColor: input.barColor ?? "#111111",
    background: input.background ?? "#ffffff",
  };
}

function normalizeLayerBase(source: Record<string, unknown>, type: CoverLayerType, fallbackId: string): CoverLayerBase {
  return {
    id: text(source.id, fallbackId, 80).replace(/[^a-z0-9_-]/gi, "-") || fallbackId,
    type,
    name: text(source.name, type === "text" ? "Text" : type, 80),
    panel: oneOf(source.panel, PANELS, "front"),
    x: decimal(source.x, 0, -20, 60),
    y: decimal(source.y, 0, -20, 60),
    width: decimal(source.width, 1, 0.02, 60),
    height: decimal(source.height, 0.4, 0.02, 60),
    rotation: decimal(source.rotation, 0, -360, 360),
    opacity: decimal(source.opacity, 1, 0, 1),
    blendMode: oneOf(source.blendMode, BLEND_MODES, "normal"),
    visible: boolean(source.visible, true),
    locked: boolean(source.locked, false),
    groupId: text(source.groupId, "", 80) || null,
    shadow: normalizeShadow(source.shadow),
    glow: normalizeGlow(source.glow),
    fade: normalizeFade(source.fade),
  };
}

function normalizeFade(value: unknown): CoverLayerFade {
  const source = isRecord(value) ? value : {};
  return {
    mode: oneOf(source.mode, ["none", "bottom", "top", "left", "right", "vignette"] as const, "none"),
    size: decimal(source.size, 0.35, 0, 1),
  };
}

function normalizeShadow(value: unknown): CoverLayerShadow {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, false),
    color: color(source.color, "#000000"),
    blur: decimal(source.blur, 0.16, 0, 1),
    offsetX: decimal(source.offsetX, 0.04, -1, 1),
    offsetY: decimal(source.offsetY, 0.06, -1, 1),
    opacity: decimal(source.opacity, 0.35, 0, 1),
  };
}

function normalizeGlow(value: unknown): CoverLayerGlow {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, false),
    color: color(source.color, "#c9a227"),
    blur: decimal(source.blur, 0.22, 0, 1),
    opacity: decimal(source.opacity, 0.4, 0, 1),
  };
}

function normalizeTextHighlight(value: unknown): CoverTextHighlight {
  const source = isRecord(value) ? value : {};
  return {
    enabled: boolean(source.enabled, false),
    color: color(source.color, "#f2c6a0"),
    opacity: decimal(source.opacity, 0.65, 0, 1),
    padding: decimal(source.padding, 0.04, 0, 0.3),
    radius: decimal(source.radius, 0.02, 0, 0.2),
  };
}

function normalizeLayer(value: unknown, index: number): CoverLayer | null {
  if (!isRecord(value)) return null;
  const type = oneOf(value.type, LAYER_TYPES, "text");
  const base = normalizeLayerBase(value, type, `layer-${index + 1}`);
  if (type === "text") {
    return {
      ...base,
      type,
      text: text(value.text, "", 5000),
      fontFamily: oneOf(value.fontFamily, FONT_IDS, "serif"),
      fontSize: decimal(value.fontSize, 12, 4, 240),
      fontWeight: integer(value.fontWeight, 400, 100, 900),
      italic: boolean(value.italic, false),
      align: oneOf(value.align, ["left", "center", "right", "justify"] as const, "left"),
      verticalAlign: oneOf(value.verticalAlign, ["top", "middle", "bottom"] as const, "top"),
      lineHeight: decimal(value.lineHeight, 1.3, 0.7, 3),
      letterSpacing: decimal(value.letterSpacing, 0, -0.15, 1),
      color: color(value.color, DEFAULT_TEXT_COLOR),
      uppercase: boolean(value.uppercase, false),
      effect: oneOf(value.effect, ["none", "soft", "hard", "glow", "outline"] as const, "none"),
      effectColor: color(value.effectColor, "#000000"),
      curve: decimal(value.curve, 0, -100, 100),
      customFont: text(value.customFont, "", 80).replace(/[<>{};\\"'`]/g, "").trim(),
      highlight: normalizeTextHighlight(value.highlight),
    };
  }
  if (type === "image") {
    return {
      ...base,
      type,
      src: text(value.src, "", 24_000_000),
      sourceWidth: integer(value.sourceWidth, 0, 0, 100_000),
      sourceHeight: integer(value.sourceHeight, 0, 0, 100_000),
      fit: value.fit === "contain" ? "contain" : "cover",
      radius: decimal(value.radius, 0, 0, 12),
      grayscale: boolean(value.grayscale, false),
      sepia: boolean(value.sepia, false),
      brightness: decimal(value.brightness, 100, 20, 180),
      contrast: decimal(value.contrast, 100, 20, 220),
      saturation: decimal(value.saturation, 100, 0, 220),
      hue: integer(value.hue, 0, -180, 180),
      blur: decimal(value.blur, 0, 0, 0.08),
      tint: color(value.tint, "#ffffff"),
      tintStrength: decimal(value.tintStrength, 0, 0, 1),
      mask: oneOf(value.mask, IMAGE_MASKS, "none"),
      focusX: decimal(value.focusX, 0.5, 0, 1),
      focusY: decimal(value.focusY, 0.5, 0, 1),
      flipX: boolean(value.flipX, false),
      flipY: boolean(value.flipY, false),
    };
  }
  if (type === "shape") {
    return {
      ...base,
      type,
      shape: oneOf(value.shape, SHAPES, "rectangle"),
      fill: normalizeFill(value.fill, coverFill(DEFAULT_ACCENT)),
      radius: decimal(value.radius, 0, 0, 12),
      strokeColor: color(value.strokeColor, "#000000"),
      strokeWidth: decimal(value.strokeWidth, 0, 0, 1),
      dash: oneOf(value.dash, DASH_STYLES, "solid"),
    };
  }
  if (type === "line") {
    return {
      ...base,
      type,
      color: color(value.color, DEFAULT_ACCENT),
      dash: oneOf(value.dash, DASH_STYLES, "solid"),
    };
  }
  if (type === "symbol") {
    return {
      ...base,
      type,
      glyph: text(value.glyph, "✦", 8),
      color: color(value.color, DEFAULT_ACCENT),
    };
  }
  if (type === "artwork") {
    return {
      ...base,
      type,
      graphicId: text(value.graphicId, BOOK_GRAPHICS[0]?.id ?? "fleuron", 80),
      color: color(value.color, DEFAULT_ACCENT),
    };
  }
  return {
    ...base,
    type: "barcode",
    showText: boolean(value.showText, true),
    barColor: color(value.barColor, "#111111"),
    background: color(value.background, "#ffffff"),
  };
}

export function parseCoverDocument(value: unknown, fallback: BookCoverDocument = emptyCoverDocument()): BookCoverDocument {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = undefined;
    }
  }
  const source = isRecord(parsed) ? parsed : {};
  const groups = Array.isArray(source.groups)
    ? source.groups.slice(0, 60).map((group, index) => normalizeGroup(group, index)).filter((group): group is CoverLayerGroup => Boolean(group))
    : fallback.groups.map((group) => ({ ...group }));
  const groupIds = new Set(groups.map((group) => group.id));
  const layers = (Array.isArray(source.layers)
    ? source.layers.slice(0, 120).map((layer, index) => normalizeLayer(layer, index)).filter((layer): layer is CoverLayer => Boolean(layer))
    : fallback.layers.map((layer) => ({ ...layer })))
    .map((layer) => layer.groupId && !groupIds.has(layer.groupId) ? { ...layer, groupId: null } : layer);
  const guides = Array.isArray(source.guides)
    ? source.guides.slice(0, 80).map((guide, index) => normalizeGuide(guide, index)).filter((guide): guide is CoverGuideline => Boolean(guide))
    : fallback.guides.map((guide) => ({ ...guide }));
  const palette = Array.isArray(source.palette)
    ? [...new Set(source.palette.filter((entry): entry is string => typeof entry === "string" && /^#[0-9a-f]{6}$/i.test(entry)).map((entry) => entry.toLocaleLowerCase()))].slice(0, 16)
    : fallback.palette.map((entry) => entry);
  return {
    version: 1,
    templateId: text(source.templateId, fallback.templateId, 80),
    background: normalizeFill(source.background, fallback.background),
    layers,
    groups,
    palette,
    guides,
    showGuides: boolean(source.showGuides, fallback.showGuides),
    showGrid: boolean(source.showGrid, fallback.showGrid),
    showBleed: boolean(source.showBleed, fallback.showBleed),
    showRulers: boolean(source.showRulers, fallback.showRulers),
  };
}

function normalizeGroup(value: unknown, index: number): CoverLayerGroup | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, `group-${index + 1}`, 80),
    name: text(value.name, "Group", 80),
    visible: boolean(value.visible, true),
    locked: boolean(value.locked, false),
    collapsed: boolean(value.collapsed, false),
  };
}

function normalizeGuide(value: unknown, index: number): CoverGuideline | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, `guide-${index}`, 80),
    axis: oneOf(value.axis, ["x", "y"], "x"),
    panel: oneOf(value.panel, PANELS, "front"),
    position: decimal(value.position, 0, -100, 100),
  };
}

/* --------------------------------------------------------------- tokens */

export function countCoverWords(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_>`~\-[\]()]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function estimateManuscriptPages(book: Book, chapters: Chapter[]) {
  const words = chapters.reduce((total, chapter) => total + countCoverWords(chapter.content), 0);
  if (words === 0) return 0;
  const trim = coverTrimSize(book.trim_size);
  const margin = Number.isFinite(book.margin) ? clamp(book.margin, 0.2, 3) : 1;
  const usableArea = Math.max(2, (trim.width - margin * 2) * (trim.height - margin * 2));
  const typeFactor = clamp(12 / (book.font_size || 12), 0.75, 1.4);
  const wordsPerPage = clamp(Math.round(usableArea * 10.5 * typeFactor), 120, 900);
  return Math.ceil(words / wordsPerPage) + 8;
}

export function coverTokenValues(book: Book, cover: BookCoverDesign) {
  const title = book.title.trim() || "Untitled manuscript";
  const year = new Date().getFullYear().toString();
  return {
    title,
    subtitle: book.subtitle.trim(),
    tagline: book.subtitle.trim() || book.genre.trim(),
    author: book.author.trim(),
    description: book.description.trim(),
    backCopy: (cover.backCopy || book.description).trim(),
    authorBio: (cover.authorBio || "").trim(),
    genre: book.genre.trim(),
    kicker: book.genre.trim(),
    publisher: (cover.publisher || "").trim(),
    isbn: (cover.isbn || "").trim(),
    price: (cover.price || "").trim(),
    year,
    pageCount: String(cover.pageCount),
    spine: cover.spineWidthOverride > 0 ? cover.spineWidthOverride.toFixed(3) : "",
  };
}

export function resolveCoverTokenText(value: string, book: Book, cover: BookCoverDesign) {
  const tokens = Object.fromEntries(Object.entries(coverTokenValues(book, cover)).map(([key, token]) => [key.toLocaleLowerCase(), token])) as Record<string, string>;
  return value.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_match, key: string) => tokens[key.toLocaleLowerCase()] ?? "").replace(/\\n/g, "\n");
}

/* -------------------------------------------------------------- geometry */

export function layerSpreadRect(metrics: CoverMetrics, layer: CoverLayer): CoverPanelRect {
  if (layer.panel === "wrap") return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  const origin = metrics.panelOrigins[layer.panel];
  return { x: origin.x + layer.x, y: origin.y + layer.y, width: layer.width, height: layer.height };
}

export function layerCenter(metrics: CoverMetrics, layer: CoverLayer) {
  const rect = layerSpreadRect(metrics, layer);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function layerForPanel(layer: CoverLayer, panel: CoverPanel) {
  return panel === "wrap" || layer.panel === panel || layer.panel === "wrap";
}

export function coverLayerGroup(doc: BookCoverDocument, layer: CoverLayer) {
  return layer.groupId ? doc.groups.find((group) => group.id === layer.groupId) ?? null : null;
}

export function coverLayerVisible(doc: BookCoverDocument, layer: CoverLayer) {
  return layer.visible && (coverLayerGroup(doc, layer)?.visible ?? true);
}

export function coverLayerLocked(doc: BookCoverDocument, layer: CoverLayer) {
  return layer.locked || (coverLayerGroup(doc, layer)?.locked ?? false);
}

export function reflowSpineLayers(doc: BookCoverDocument, previousSpineWidth: number, nextSpineWidth: number): BookCoverDocument {
  if (previousSpineWidth <= 0 || Math.abs(previousSpineWidth - nextSpineWidth) < 0.0005) return doc;
  const ratio = nextSpineWidth / previousSpineWidth;
  const shift = (nextSpineWidth - previousSpineWidth) / 2;
  return {
    ...doc,
    layers: doc.layers.map((layer) => layer.panel === "spine"
      ? { ...layer, x: roundInches((layer.x + layer.width / 2) * ratio - layer.width / 2) }
      : layer),
    guides: doc.guides.map((guide) => guide.panel === "spine" && guide.axis === "x"
      ? { ...guide, position: roundInches(guide.position + shift) }
      : guide),
  };
}

/* ------------------------------------------------------------- barcode */

export function isbnDigits(value: string) {
  return (value || "").replace(/[^0-9]/g, "");
}

export function isbn13CheckDigit(firstTwelve: string) {
  const digits = firstTwelve.replace(/[^0-9]/g, "").slice(0, 12);
  if (digits.length !== 12) return 0;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(digits[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function normalizeIsbn13(value: string) {
  const digits = isbnDigits(value);
  if (digits.length === 10) {
    const body = `978${digits.slice(0, 9)}`;
    return `${body}${isbn13CheckDigit(body)}`;
  }
  if (digits.length === 12) return `${digits}${isbn13CheckDigit(digits)}`;
  if (digits.length === 13) return `${digits.slice(0, 12)}${isbn13CheckDigit(digits.slice(0, 12))}`;
  return "";
}

export function isbnIsValid(value: string) {
  const digits = isbnDigits(value);
  return digits.length === 10 || digits.length === 12 || digits.length === 13;
}

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13Bits(value: string) {
  const isbn = normalizeIsbn13(value);
  if (isbn.length !== 13) return "";
  const digits = isbn.split("").map(Number);
  const parity = EAN_PARITY[digits[0]] ?? EAN_PARITY[0];
  let bits = "101";
  for (let index = 0; index < 6; index += 1) {
    const digit = digits[index + 1];
    bits += parity[index] === "L" ? EAN_L[digit] : EAN_G[digit];
  }
  bits += "01010";
  for (let index = 6; index < 12; index += 1) bits += EAN_R[digits[index]];
  bits += "101";
  return bits;
}

export function barcodeSvgMarkup(value: string, barColor = "#111111", placeholder = true) {
  const bits = ean13Bits(value);
  const width = 113;
  const height = 54;
  const quiet = 9;
  if (!bits) {
    if (!placeholder) return "";
    const stripes = Array.from({ length: 62 }, (_, index) => {
      const x = 12 + index * 1.42;
      return `<rect x="${x.toFixed(2)}" y="4" width="${index % 3 === 0 ? 0.8 : 0.42}" height="46" fill="${barColor}" opacity=".24"/>`;
    }).join("");
    return `<svg class="cover-barcode-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${stripes}</svg>`;
  }
  const bars: string[] = [];
  let runStart = -1;
  for (let index = 0; index <= bits.length; index += 1) {
    const filled = bits[index] === "1";
    if (filled && runStart < 0) runStart = index;
    if (!filled && runStart >= 0) {
      bars.push(`<rect x="${quiet + runStart}" y="0" width="${index - runStart}" height="${height}" fill="${barColor}"/>`);
      runStart = -1;
    }
  }
  return `<svg class="cover-barcode-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bars.join("")}</svg>`;
}

/* -------------------------------------------------------------- shapes */

export function coverShapePath(shape: CoverShapeKind) {
  if (shape === "triangle") return "M50 4 L96 94 L4 94 Z";
  if (shape === "diamond") return "M50 2 L98 50 L50 98 L2 50 Z";
  if (shape === "star") return "M50 3 L61.8 36.5 L97.2 36.5 L68.6 57.2 L79.9 91.1 L50 70.4 L20.1 91.1 L31.4 57.2 L2.8 36.5 L38.2 36.5 Z";
  if (shape === "burst") {
    const points = Array.from({ length: 24 }, (_, index) => {
      const radius = index % 2 === 0 ? 49 : 34;
      const angle = -Math.PI / 2 + (index * Math.PI) / 12;
      return `${(50 + Math.cos(angle) * radius).toFixed(2)},${(50 + Math.sin(angle) * radius).toFixed(2)}`;
    });
    return `M${points.join(" L")} Z`;
  }
  if (shape === "heart") return "M50 92 C22 72 5 55 5 34 C5 16 18 6 33 6 C42 6 48 11 50 17 C52 11 58 6 67 6 C82 6 95 16 95 34 C95 55 78 72 50 92 Z";
  if (shape === "arch") return "M6 98 L6 46 C6 20 26 4 50 4 C74 4 94 20 94 46 L94 98 Z";
  if (shape === "octagon") return "M30 4 L70 4 L96 30 L96 70 L70 96 L30 96 L4 70 L4 30 Z";
  if (shape === "shield") return "M50 3 L92 15 L88 55 C86 74 70 89 50 96 C30 89 14 74 12 55 L8 15 Z";
  if (shape === "ticket") return "M6 24 L94 24 L94 42 A8 8 0 0 0 94 58 L94 76 L6 76 L6 58 A8 8 0 0 1 6 42 Z";
  if (shape === "banner") return "M6 18 L94 18 L94 68 L74 80 L50 68 L26 80 L6 68 Z";
  if (shape === "leaf") return "M50 4 C82 14 96 42 87 68 C78 92 50 98 22 86 C8 60 18 28 50 4 Z";
  if (shape === "arrow") return "M4 34 L60 34 L60 14 L96 50 L60 86 L60 66 L4 66 Z";
  return "";
}

/* ------------------------------------------------------------ templates */

const round = roundInches;

function safeMargin(trimWidth: number, factor = 0.085, minimum = 0.42) {
  return Math.max(minimum, trimWidth * factor);
}

function titleSize(trimWidth: number, title: string) {
  const base = trimWidth <= 5.3 ? 31 : trimWidth <= 5.8 ? 35 : trimWidth <= 6.3 ? 38 : trimWidth <= 7.3 ? 42 : trimWidth <= 8.1 ? 47 : trimWidth <= 9 ? 53 : 59;
  const length = title.trim().length || 8;
  const adjust = length > 32 ? -10 : length > 24 ? -6 : length < 10 ? 9 : length < 16 ? 4 : 0;
  return clamp(base + adjust, 24, 86);
}

function spineFontSize(spineWidth: number, titleLength: number) {
  const byWidth = spineWidth * 13;
  const byLength = titleLength > 32 ? 7 : titleLength > 20 ? 8 : 9.5;
  return Math.round(clamp(Math.min(byWidth, byLength), 6, 13) * 10) / 10;
}

function backBodySize(trimWidth: number) {
  if (trimWidth <= 5.3) return 8;
  if (trimWidth <= 6.3) return 8.7;
  if (trimWidth <= 7.5) return 9.2;
  if (trimWidth <= 8.6) return 9.8;
  return 10.5;
}

function addBarcode(layers: CoverLayer[], metrics: CoverMetrics, margin: number) {
  const width = Math.min(2.05, metrics.trimWidth * 0.42);
  const height = width * 0.59;
  layers.push(barcodeLayer({
    id: "back-barcode",
    name: "ISBN barcode",
    panel: "back",
    x: round(metrics.trimWidth - margin - width),
    y: round(metrics.trimHeight - margin - height),
    width: round(width),
    height: round(height),
    showText: true,
  }));
}

function addSpineBasics(
  layers: CoverLayer[],
  book: Book,
  metrics: CoverMetrics,
  ink: string,
  accent: string,
  opts: { rule?: boolean; ornament?: string; author?: boolean } = {},
) {
  const spine = metrics.spineWidth;
  const titleBoxWidth = Math.min(metrics.trimHeight - 1.4, 6.6);
  const titleBoxHeight = Math.max(0.14, spine * 0.56);
  const title = book.title.trim() || "Untitled";
  const titleSize = spineFontSize(spine, title.length);
  layers.push(textLayer({
    id: "spine-title",
    name: "Spine title",
    panel: "spine",
    x: round(spine / 2 - titleBoxWidth / 2),
    y: round(metrics.trimHeight * 0.42 - titleBoxHeight / 2),
    width: round(titleBoxWidth),
    height: round(titleBoxHeight),
    text: "{{title}}",
    fontFamily: opts.ornament ? "display" : "sans",
    fontSize: titleSize,
    fontWeight: 600,
    align: "center",
    verticalAlign: "middle",
    lineHeight: 1,
    letterSpacing: 0.08,
    uppercase: true,
    color: ink,
    rotation: -90,
  }));
  if (opts.author !== false) {
    const authorBox = Math.max(0.12, spine * 0.4);
    layers.push(textLayer({
      id: "spine-author",
      name: "Spine author",
      panel: "spine",
      x: round(spine / 2 - (titleBoxWidth * 0.72) / 2),
      y: round(metrics.trimHeight * 0.74 - authorBox / 2),
      width: round(titleBoxWidth * 0.72),
      height: round(authorBox),
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: Math.max(6, Math.round(spine * 8 * 10) / 10),
      fontWeight: 500,
      align: "center",
      verticalAlign: "middle",
      lineHeight: 1,
      letterSpacing: 0.15,
      uppercase: true,
      color: ink,
      rotation: -90,
      opacity: 0.9,
    }));
  }
  if (opts.rule) {
    layers.push(lineLayer({
      id: "spine-rule-top",
      name: "Spine top rule",
      panel: "spine",
      x: round(spine * 0.25),
      y: round(metrics.trimHeight * 0.12),
      width: round(spine * 0.5),
      height: 0.012,
      color: accent,
      opacity: 0.7,
    }));
  }
  if (opts.ornament) {
    layers.push(symbolLayer({
      id: "spine-ornament",
      name: "Spine ornament",
      panel: "spine",
      x: round(spine / 2 - 0.11),
      y: round(metrics.trimHeight * 0.88),
      width: 0.22,
      height: 0.22,
      glyph: opts.ornament,
      color: accent,
      opacity: 0.9,
    }));
  }
}

function atelierTemplate(book: Book, _cover: BookCoverDesign, metrics: CoverMetrics, accent: string): BookCoverDocument {
  const w = metrics.trimWidth;
  const h = metrics.trimHeight;
  const m = safeMargin(w);
  const ink = "#241c17";
  const paper = "#f6efe3";
  const title = book.title.trim() || "Untitled";
  const size = titleSize(w, title);
  const layers: CoverLayer[] = [
    shapeLayer({
      id: "front-orbit",
      name: "Accent orbit",
      panel: "front",
      x: round(w - 2.15),
      y: round(h - 2.55),
      width: 2.9,
      height: 2.9,
      shape: "ellipse",
      fill: noCoverFill(),
      strokeColor: accent,
      strokeWidth: 0.013,
      opacity: 0.3,
    }),
    lineLayer({ id: "front-top-rule", name: "Top rule", panel: "front", x: m, y: round(m + 0.24), width: round(w - m * 2), height: 0.009, color: accent, opacity: 0.75 }),
    textLayer({
      id: "front-kicker",
      name: "Kicker",
      panel: "front",
      x: m,
      y: m,
      width: round(w - m * 2),
      height: 0.28,
      text: "{{kicker}}",
      fontFamily: "sans",
      fontSize: 8,
      fontWeight: 600,
      letterSpacing: 0.22,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "front-title",
      name: "Title",
      panel: "front",
      x: m,
      y: round(h * 0.25),
      width: round(w - m * 2),
      height: 2.5,
      text: "{{title}}",
      fontFamily: "display",
      fontSize: size,
      fontWeight: 500,
      align: "left",
      lineHeight: 0.94,
      letterSpacing: -0.035,
      color: ink,
    }),
    textLayer({
      id: "front-tagline",
      name: "Tagline",
      panel: "front",
      x: m,
      y: round(h * 0.25 + 2.62),
      width: round(w - m * 2),
      height: 0.5,
      text: "{{tagline}}",
      fontFamily: "humanist",
      fontSize: 10.5,
      italic: true,
      lineHeight: 1.25,
      letterSpacing: 0.02,
      color: shadeColor(ink, 0.28),
    }),
    lineLayer({ id: "front-author-rule", name: "Author rule", panel: "front", x: m, y: round(h - m - 0.56), width: round(w - m * 2), height: 0.009, color: ink, opacity: 0.25 }),
    textLayer({
      id: "front-author",
      name: "Author",
      panel: "front",
      x: m,
      y: round(h - m - 0.48),
      width: round(w - m * 2),
      height: 0.3,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: 0.18,
      uppercase: true,
      color: ink,
    }),
    textLayer({
      id: "back-eyebrow",
      name: "Back eyebrow",
      panel: "back",
      x: m,
      y: round(m + 0.1),
      width: round(w - m * 2),
      height: 0.3,
      text: "ABOUT THE BOOK",
      fontFamily: "sans",
      fontSize: 7.8,
      fontWeight: 700,
      letterSpacing: 0.24,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "back-copy",
      name: "Back cover copy",
      panel: "back",
      x: m,
      y: round(m + 0.72),
      width: round(w - m * 2),
      height: round(h - m * 2 - 1.9),
      text: "{{backCopy}}",
      fontFamily: "humanist",
      fontSize: backBodySize(w),
      align: "left",
      lineHeight: 1.55,
      letterSpacing: 0.005,
      color: ink,
    }),
    symbolLayer({
      id: "back-fleuron",
      name: "Fleuron",
      panel: "back",
      x: m,
      y: round(h - m - 1.95),
      width: 0.34,
      height: 0.34,
      glyph: "❧",
      color: accent,
      opacity: 0.85,
    }),
    textLayer({
      id: "back-author",
      name: "Back author",
      panel: "back",
      x: m,
      y: round(h - m - 0.38),
      width: round(w - m * 2 - Math.min(2.05, w * 0.42) - 0.22),
      height: 0.36,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 8.4,
      fontWeight: 650,
      letterSpacing: 0.14,
      uppercase: true,
      color: ink,
    }),
  ];
  addBarcode(layers, metrics, m);
  addSpineBasics(layers, book, metrics, ink, accent, { author: true, rule: true, ornament: "✦" });
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "atelier",
    guides: [],
    background: {
      type: "gradient",
      color: paper,
      gradient: { type: "linear", angle: 145, stops: [{ color: "#f8f2e8", position: 0 }, { color: "#eadfcb", position: 1 }] },
    },
    layers,
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

function noirTemplate(book: Book, _cover: BookCoverDesign, metrics: CoverMetrics, accent: string): BookCoverDocument {
  const w = metrics.trimWidth;
  const h = metrics.trimHeight;
  const m = safeMargin(w);
  const ink = "#f5f0e7";
  const title = book.title.trim() || "Untitled";
  const size = Math.min(titleSize(w, title) + 6, 88);
  const layers: CoverLayer[] = [
    shapeLayer({
      id: "front-glow",
      name: "Ambient glow",
      panel: "wrap",
      x: round(metrics.fullWidth * 0.54),
      y: round(-metrics.bleed - 0.5),
      width: round(metrics.fullWidth * 0.58),
      height: round(metrics.fullHeight * 0.75),
      shape: "ellipse",
      fill: { type: "solid", color: "#33445a", gradient: coverFill("#33445a").gradient },
      opacity: 0.28,
      blendMode: "screen",
    }),
    lineLayer({ id: "front-noir-rule", name: "Gold rule", panel: "front", x: m, y: round(h * 0.16), width: round(w - m * 2), height: 0.014, color: accent }),
    textLayer({
      id: "front-kicker",
      name: "Kicker",
      panel: "front",
      x: m,
      y: round(h * 0.11),
      width: round(w - m * 2),
      height: 0.3,
      text: "A NOVEL",
      fontFamily: "sans",
      fontSize: 7.8,
      fontWeight: 700,
      letterSpacing: 0.35,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "front-title",
      name: "Title",
      panel: "front",
      x: m,
      y: round(h * 0.23),
      width: round(w - m * 2),
      height: 3.3,
      text: "{{title}}",
      fontFamily: "display",
      fontSize: size,
      fontWeight: 600,
      lineHeight: 0.88,
      letterSpacing: -0.045,
      uppercase: true,
      color: ink,
      effect: "soft",
      effectColor: "#000000",
    }),
    textLayer({
      id: "front-tagline",
      name: "Tagline",
      panel: "front",
      x: m,
      y: round(h * 0.69),
      width: round(w - m * 2),
      height: 0.7,
      text: "{{tagline}}",
      fontFamily: "sans",
      fontSize: 8.5,
      fontWeight: 500,
      letterSpacing: 0.24,
      uppercase: true,
      lineHeight: 1.4,
      color: accent,
    }),
    textLayer({
      id: "front-author",
      name: "Author",
      panel: "front",
      x: m,
      y: round(h - m - 0.32),
      width: round(w - m * 2),
      height: 0.36,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 10.5,
      fontWeight: 650,
      letterSpacing: 0.22,
      uppercase: true,
      color: ink,
    }),
    symbolLayer({ id: "back-quote", name: "Quote mark", panel: "back", x: m - 0.04, y: round(m - 0.28), width: 1.1, height: 1.1, glyph: "❝", color: accent, opacity: 0.2 }),
    textLayer({
      id: "back-copy",
      name: "Back cover copy",
      panel: "back",
      x: m,
      y: round(m + 0.75),
      width: round(w - m * 2),
      height: round(h - m * 2 - 1.9),
      text: "{{backCopy}}",
      fontFamily: "serif",
      fontSize: backBodySize(w),
      lineHeight: 1.58,
      color: ink,
    }),
    lineLayer({ id: "back-rule", name: "Back rule", panel: "back", x: m, y: round(h - m - 1.5), width: round(w - m * 2), height: 0.01, color: accent, opacity: 0.5 }),
    textLayer({
      id: "back-author",
      name: "Back author",
      panel: "back",
      x: m,
      y: round(h - m - 1.32),
      width: round(w - m * 2 - 2.2),
      height: 0.8,
      text: "{{author}}\n{{authorBio}}",
      fontFamily: "sans",
      fontSize: 7.2,
      lineHeight: 1.45,
      color: shadeColor(ink, -0.16),
    }),
  ];
  addBarcode(layers, metrics, m);
  addSpineBasics(layers, book, metrics, ink, accent, { rule: true, ornament: "✦" });
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "noir",
    guides: [],
    background: {
      type: "gradient",
      color: "#14161a",
      gradient: { type: "linear", angle: 155, stops: [{ color: "#0c0d10", position: 0 }, { color: "#242933", position: 0.55 }, { color: "#0b0c0f", position: 1 }] },
    },
    layers,
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

function photoTemplate(book: Book, cover: BookCoverDesign, metrics: CoverMetrics, accent: string): BookCoverDocument {
  const w = metrics.trimWidth;
  const h = metrics.trimHeight;
  const m = safeMargin(w);
  const ink = "#fbf7f0";
  const title = book.title.trim() || "Untitled";
  const size = Math.min(titleSize(w, title) + 4, 84);
  const layers: CoverLayer[] = [];
  if (cover.image) {
    layers.push(imageLayer({ id: "wrap-image", name: "Wrap photograph", panel: "wrap", x: 0, y: 0, width: metrics.fullWidth, height: metrics.fullHeight, src: cover.image, fit: "cover" }));
  } else {
    layers.push(
      shapeLayer({ id: "wrap-orb-a", name: "Atmosphere", panel: "wrap", x: round(-1.2), y: round(-1), width: round(metrics.trimWidth + 2), height: round(metrics.trimHeight + 1.5), shape: "ellipse", fill: { type: "solid", color: "#4f7c86", gradient: coverFill("#4f7c86").gradient }, opacity: 0.6 }),
      shapeLayer({ id: "wrap-orb-b", name: "Sun", panel: "wrap", x: round(metrics.fullWidth * 0.53), y: round(metrics.trimHeight * 0.22), width: round(metrics.fullWidth * 0.35), height: round(metrics.fullWidth * 0.35), shape: "ellipse", fill: { type: "solid", color: accent, gradient: coverFill(accent).gradient }, opacity: 0.7, blendMode: "screen" }),
    );
  }
  layers.push(
    shapeLayer({
      id: "front-shade",
      name: "Front legibility shade",
      panel: "front",
      x: 0,
      y: 0,
      width: w,
      height: h,
      shape: "rectangle",
      fill: { type: "gradient", color: "#000000", gradient: { type: "linear", angle: 180, stops: [{ color: "#00000000", position: 0 }, { color: "#00000055", position: 0.45 }, { color: "#000000d9", position: 1 }] } },
      opacity: 0.92,
    }),
    shapeLayer({
      id: "back-shade",
      name: "Back legibility shade",
      panel: "back",
      x: 0,
      y: 0,
      width: w,
      height: h,
      shape: "rectangle",
      fill: { type: "solid", color: "#0a0f13", gradient: coverFill("#0a0f13").gradient },
      opacity: 0.76,
    }),
    textLayer({
      id: "front-kicker",
      name: "Kicker",
      panel: "front",
      x: m,
      y: m,
      width: round(w - m * 2),
      height: 0.3,
      text: "{{genre}}",
      fontFamily: "sans",
      fontSize: 7.8,
      fontWeight: 650,
      letterSpacing: 0.3,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "front-title",
      name: "Title",
      panel: "front",
      x: m,
      y: round(h * 0.6),
      width: round(w - m * 2),
      height: 2.5,
      text: "{{title}}",
      fontFamily: "display",
      fontSize: size,
      fontWeight: 500,
      lineHeight: 0.92,
      letterSpacing: -0.035,
      color: ink,
      effect: "soft",
      effectColor: "#000000",
    }),
    textLayer({
      id: "front-tagline",
      name: "Tagline",
      panel: "front",
      x: m,
      y: round(h * 0.6 + 2.58),
      width: round(w - m * 2),
      height: 0.5,
      text: "{{tagline}}",
      fontFamily: "sans",
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: 0.12,
      uppercase: true,
      color: ink,
    }),
    lineLayer({ id: "front-author-rule", name: "Author rule", panel: "front", x: m, y: round(h - m - 0.56), width: round(w - m * 2), height: 0.01, color: accent }),
    textLayer({
      id: "front-author",
      name: "Author",
      panel: "front",
      x: m,
      y: round(h - m - 0.46),
      width: round(w - m * 2),
      height: 0.32,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 10.5,
      fontWeight: 650,
      letterSpacing: 0.2,
      uppercase: true,
      color: ink,
    }),
    textLayer({
      id: "back-eyebrow",
      name: "Back eyebrow",
      panel: "back",
      x: m,
      y: round(m + 0.15),
      width: round(w - m * 2),
      height: 0.28,
      text: "ABOUT THE BOOK",
      fontFamily: "sans",
      fontSize: 7.5,
      fontWeight: 700,
      letterSpacing: 0.26,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "back-copy",
      name: "Back cover copy",
      panel: "back",
      x: m,
      y: round(m + 0.75),
      width: round(w - m * 2),
      height: round(h - m * 2 - 1.9),
      text: "{{backCopy}}",
      fontFamily: "serif",
      fontSize: backBodySize(w),
      lineHeight: 1.58,
      color: ink,
    }),
    textLayer({
      id: "back-author",
      name: "Back author",
      panel: "back",
      x: m,
      y: round(h - m - 0.38),
      width: round(w - m * 2 - Math.min(2.05, w * 0.42) - 0.22),
      height: 0.34,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 8.4,
      fontWeight: 650,
      letterSpacing: 0.16,
      uppercase: true,
      color: ink,
    }),
    shapeLayer({ id: "spine-shade", name: "Spine shade", panel: "spine", x: 0, y: 0, width: metrics.spineWidth, height: h, shape: "rectangle", fill: { type: "solid", color: "#0a0f13", gradient: coverFill("#0a0f13").gradient }, opacity: 0.72 }),
  );
  addBarcode(layers, metrics, m);
  addSpineBasics(layers, book, metrics, ink, accent, { rule: false, ornament: "✦" });
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "photo",
    guides: [],
    background: {
      type: "gradient",
      color: "#1b2b33",
      gradient: { type: "linear", angle: 160, stops: [{ color: "#426773", position: 0 }, { color: "#16262e", position: 0.58 }, { color: "#070b0e", position: 1 }] },
    },
    layers,
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

function minimalTemplate(book: Book, _cover: BookCoverDesign, metrics: CoverMetrics, accent: string): BookCoverDocument {
  const w = metrics.trimWidth;
  const h = metrics.trimHeight;
  const m = safeMargin(w, 0.1, 0.5);
  const ink = "#111111";
  const title = book.title.trim() || "Untitled";
  const size = Math.min(titleSize(w, title) + 8, 92);
  const layers: CoverLayer[] = [
    textLayer({
      id: "front-title",
      name: "Title",
      panel: "front",
      x: m,
      y: round(h * 0.22),
      width: round(w - m * 2),
      height: 3.2,
      text: "{{title}}",
      fontFamily: "sans",
      fontSize: size,
      fontWeight: 700,
      lineHeight: 0.9,
      letterSpacing: -0.065,
      uppercase: true,
      color: ink,
    }),
    shapeLayer({ id: "front-dot", name: "Accent dot", panel: "front", x: m, y: round(h * 0.75), width: 0.12, height: 0.12, shape: "ellipse", fill: coverFill(accent), opacity: 1 }),
    textLayer({
      id: "front-tagline",
      name: "Tagline",
      panel: "front",
      x: round(m + 0.26),
      y: round(h * 0.742),
      width: round(w - m * 2 - 0.26),
      height: 0.5,
      text: "{{tagline}}",
      fontFamily: "sans",
      fontSize: 8,
      fontWeight: 500,
      letterSpacing: 0.16,
      uppercase: true,
      color: shadeColor(ink, 0.35),
    }),
    lineLayer({ id: "front-author-rule", name: "Author rule", panel: "front", x: m, y: round(h - m - 0.52), width: round(w - m * 2), height: 0.008, color: ink, opacity: 0.22 }),
    textLayer({
      id: "front-author",
      name: "Author",
      panel: "front",
      x: m,
      y: round(h - m - 0.43),
      width: round(w - m * 2),
      height: 0.28,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 8.6,
      fontWeight: 600,
      letterSpacing: 0.2,
      uppercase: true,
      color: ink,
    }),
    textLayer({
      id: "back-kicker",
      name: "Back kicker",
      panel: "back",
      x: m,
      y: round(m + 0.1),
      width: round(w - m * 2),
      height: 0.3,
      text: "{{title}}",
      fontFamily: "sans",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 0.16,
      uppercase: true,
      color: ink,
    }),
    lineLayer({ id: "back-rule", name: "Back rule", panel: "back", x: m, y: round(m + 0.52), width: round(w - m * 2), height: 0.008, color: ink, opacity: 0.24 }),
    textLayer({
      id: "back-copy",
      name: "Back cover copy",
      panel: "back",
      x: m,
      y: round(m + 0.85),
      width: round(w - m * 2),
      height: round(h - m * 2 - 2.1),
      text: "{{backCopy}}",
      fontFamily: "sans",
      fontSize: backBodySize(w),
      lineHeight: 1.62,
      color: shadeColor(ink, 0.18),
    }),
    textLayer({
      id: "back-author",
      name: "Back author",
      panel: "back",
      x: m,
      y: round(h - m - 0.4),
      width: round(w - m * 2 - Math.min(1.9, w * 0.4) - 0.25),
      height: 0.3,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 8,
      fontWeight: 600,
      letterSpacing: 0.16,
      uppercase: true,
      color: ink,
    }),
  ];
  addBarcode(layers, metrics, m);
  addSpineBasics(layers, book, metrics, ink, accent, { author: true, rule: true, ornament: "" });
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "minimal",
    guides: [],
    background: { type: "solid", color: "#fbfaf7", gradient: coverFill("#fbfaf7").gradient },
    layers,
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

function heritageTemplate(book: Book, _cover: BookCoverDesign, metrics: CoverMetrics, accent: string): BookCoverDocument {
  const w = metrics.trimWidth;
  const h = metrics.trimHeight;
  const m = safeMargin(w, 0.095, 0.48);
  const ink = "#f1e7d1";
  const title = book.title.trim() || "Untitled";
  const size = Math.min(titleSize(w, title) + 1, 78);
  const frame = (id: string, panel: CoverPanel): CoverLayer => shapeLayer({
    id,
    name: "Frame",
    panel,
    x: m,
    y: m,
    width: round((panel === "spine" ? metrics.spineWidth : w) - m * 2),
    height: round(h - m * 2),
    shape: "rectangle",
    fill: noCoverFill(),
    strokeColor: accent,
    strokeWidth: 0.014,
    radius: 0.01,
  });
  const layers: CoverLayer[] = [
    shapeLayer({
      id: "front-sun",
      name: "Sun disc",
      panel: "front",
      x: round(w / 2 - 1.5),
      y: round(h * 0.17),
      width: 3,
      height: 3,
      shape: "ellipse",
      fill: noCoverFill(),
      strokeColor: accent,
      strokeWidth: 0.01,
      opacity: 0.34,
    }),
    frame("front-frame", "front"),
    shapeLayer({
      id: "front-inner-frame",
      name: "Inner frame",
      panel: "front",
      x: round(m + 0.12),
      y: round(m + 0.12),
      width: round(w - m * 2 - 0.24),
      height: round(h - m * 2 - 0.24),
      shape: "rectangle",
      fill: noCoverFill(),
      strokeColor: accent,
      strokeWidth: 0.006,
      opacity: 0.55,
    }),
    symbolLayer({ id: "front-ornament", name: "Ornament", panel: "front", x: round(w / 2 - 0.22), y: round(h * 0.105), width: 0.44, height: 0.44, glyph: "❦", color: accent }),
    textLayer({
      id: "front-kicker",
      name: "Kicker",
      panel: "front",
      x: m,
      y: round(h * 0.155),
      width: round(w - m * 2),
      height: 0.3,
      text: "{{genre}}",
      fontFamily: "sans",
      fontSize: 7.2,
      fontWeight: 600,
      align: "center",
      letterSpacing: 0.3,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "front-title",
      name: "Title",
      panel: "front",
      x: round(m + 0.35),
      y: round(h * 0.27),
      width: round(w - m * 2 - 0.7),
      height: 3,
      text: "{{title}}",
      fontFamily: "display",
      fontSize: size,
      fontWeight: 500,
      align: "center",
      lineHeight: 0.95,
      letterSpacing: 0.01,
      uppercase: true,
      color: ink,
    }),
    textLayer({
      id: "front-tagline",
      name: "Tagline",
      panel: "front",
      x: round(m + 0.35),
      y: round(h * 0.69),
      width: round(w - m * 2 - 0.7),
      height: 0.8,
      text: "{{tagline}}",
      fontFamily: "humanist",
      fontSize: 10,
      italic: true,
      align: "center",
      lineHeight: 1.35,
      color: shadeColor(ink, -0.12),
    }),
    lineLayer({ id: "front-author-rule", name: "Author rule", panel: "front", x: round(w / 2 - 0.7), y: round(h - m - 0.62), width: 1.4, height: 0.01, color: accent }),
    textLayer({
      id: "front-author",
      name: "Author",
      panel: "front",
      x: m,
      y: round(h - m - 0.5),
      width: round(w - m * 2),
      height: 0.34,
      text: "{{author}}",
      fontFamily: "display",
      fontSize: 11,
      fontWeight: 500,
      align: "center",
      letterSpacing: 0.14,
      uppercase: true,
      color: ink,
    }),
    frame("back-frame", "back"),
    symbolLayer({ id: "back-ornament", name: "Back ornament", panel: "back", x: round(w / 2 - 0.18), y: round(m + 0.22), width: 0.36, height: 0.36, glyph: "✦", color: accent, opacity: 0.9 }),
    textLayer({
      id: "back-eyebrow",
      name: "Back eyebrow",
      panel: "back",
      x: m,
      y: round(m + 0.68),
      width: round(w - m * 2),
      height: 0.28,
      text: "PRAISE & STORY",
      fontFamily: "sans",
      fontSize: 7,
      fontWeight: 700,
      align: "center",
      letterSpacing: 0.28,
      uppercase: true,
      color: accent,
    }),
    textLayer({
      id: "back-copy",
      name: "Back cover copy",
      panel: "back",
      x: round(m + 0.3),
      y: round(m + 1.12),
      width: round(w - m * 2 - 0.6),
      height: round(h - m * 2 - 2.2),
      text: "{{backCopy}}",
      fontFamily: "humanist",
      fontSize: backBodySize(w),
      align: "center",
      lineHeight: 1.6,
      color: ink,
    }),
    textLayer({
      id: "back-author",
      name: "Back author",
      panel: "back",
      x: round(m + 0.3),
      y: round(h - m - 0.48),
      width: round(w - m * 2 - 0.6),
      height: 0.3,
      text: "{{author}}",
      fontFamily: "display",
      fontSize: 8.4,
      align: "center",
      letterSpacing: 0.14,
      uppercase: true,
      color: accent,
    }),
    shapeLayer({ id: "spine-rule-a", name: "Spine rule", panel: "spine", x: round(metrics.spineWidth * 0.38), y: round(h * 0.08), width: round(metrics.spineWidth * 0.24), height: 0.012, shape: "rectangle", fill: coverFill(accent) }),
    shapeLayer({ id: "spine-rule-b", name: "Spine rule", panel: "spine", x: round(metrics.spineWidth * 0.38), y: round(h * 0.92), width: round(metrics.spineWidth * 0.24), height: 0.012, shape: "rectangle", fill: coverFill(accent) }),
  ];
  addBarcode(layers, metrics, m);
  addSpineBasics(layers, book, metrics, ink, accent, { author: true, rule: false, ornament: "❦" });
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "heritage",
    guides: [],
    background: {
      type: "gradient",
      color: "#1f3a2d",
      gradient: { type: "radial", angle: 90, stops: [{ color: "#2c4d3a", position: 0 }, { color: "#1b3226", position: 0.62 }, { color: "#122219", position: 1 }] },
    },
    layers,
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

function boldTemplate(book: Book, _cover: BookCoverDesign, metrics: CoverMetrics, accent: string): BookCoverDocument {
  const w = metrics.trimWidth;
  const h = metrics.trimHeight;
  const m = safeMargin(w);
  const ink = "#171310";
  const cream = "#f7eddd";
  const title = book.title.trim() || "Untitled";
  const size = Math.min(titleSize(w, title) + 2, 80);
  const bandHeight = round(h * 0.63);
  const frontBand: CoverFill = { type: "gradient", color: accent, gradient: { type: "linear", angle: 145, stops: [{ color: shadeColor(accent, 0.08), position: 0 }, { color: shadeColor(accent, -0.22), position: 1 }] } };
  const layers: CoverLayer[] = [
    shapeLayer({ id: "front-band", name: "Colour block", panel: "front", x: 0, y: 0, width: w, height: bandHeight, shape: "rectangle", fill: frontBand }),
    shapeLayer({ id: "back-band", name: "Back colour band", panel: "back", x: 0, y: 0, width: w, height: round(h * 0.2), shape: "rectangle", fill: frontBand }),
    textLayer({
      id: "front-kicker",
      name: "Kicker",
      panel: "front",
      x: m,
      y: round(m + 0.05),
      width: round(w - m * 2),
      height: 0.3,
      text: "{{genre}}",
      fontFamily: "sans",
      fontSize: 7.8,
      fontWeight: 700,
      letterSpacing: 0.26,
      uppercase: true,
      color: cream,
    }),
    textLayer({
      id: "front-title",
      name: "Title",
      panel: "front",
      x: m,
      y: round(bandHeight * 0.24),
      width: round(w - m * 2),
      height: round(bandHeight * 0.55),
      text: "{{title}}",
      fontFamily: "sans",
      fontSize: size,
      fontWeight: 800,
      lineHeight: 0.87,
      letterSpacing: -0.06,
      uppercase: true,
      color: cream,
    }),
    textLayer({
      id: "front-tagline",
      name: "Tagline",
      panel: "front",
      x: m,
      y: round(bandHeight - 0.72),
      width: round(w - m * 2),
      height: 0.5,
      text: "{{tagline}}",
      fontFamily: "sans",
      fontSize: 8.3,
      fontWeight: 600,
      letterSpacing: 0.18,
      uppercase: true,
      color: cream,
    }),
    textLayer({
      id: "front-author",
      name: "Author",
      panel: "front",
      x: m,
      y: round(h - m - 0.4),
      width: round(w - m * 2),
      height: 0.4,
      text: "{{author}}",
      fontFamily: "sans",
      fontSize: 12,
      fontWeight: 750,
      letterSpacing: 0.14,
      uppercase: true,
      color: ink,
    }),
    textLayer({
      id: "back-kicker",
      name: "Back kicker",
      panel: "back",
      x: m,
      y: round(m - 0.03),
      width: round(w - m * 2),
      height: 0.3,
      text: "PRAISE FOR {{title}}",
      fontFamily: "sans",
      fontSize: 7.4,
      fontWeight: 700,
      letterSpacing: 0.22,
      uppercase: true,
      color: cream,
    }),
    textLayer({
      id: "back-copy",
      name: "Back cover copy",
      panel: "back",
      x: m,
      y: round(h * 0.26),
      width: round(w - m * 2),
      height: round(h - h * 0.26 - m - 1.7),
      text: "{{backCopy}}",
      fontFamily: "sans",
      fontSize: backBodySize(w),
      lineHeight: 1.58,
      color: shadeColor(ink, 0.15),
    }),
    lineLayer({ id: "back-rule", name: "Back rule", panel: "back", x: m, y: round(h - m - 1.44), width: round(w - m * 2), height: 0.012, color: ink, opacity: 0.28 }),
    textLayer({
      id: "back-author",
      name: "Back author",
      panel: "back",
      x: m,
      y: round(h - m - 1.28),
      width: round(w - m * 2 - Math.min(2.05, w * 0.42) - 0.2),
      height: 0.8,
      text: "{{author}}\n{{publisher}}",
      fontFamily: "sans",
      fontSize: 8,
      fontWeight: 600,
      lineHeight: 1.45,
      color: ink,
    }),
    shapeLayer({ id: "spine-band", name: "Spine colour", panel: "spine", x: 0, y: 0, width: metrics.spineWidth, height: h, shape: "rectangle", fill: frontBand }),
  ];
  addBarcode(layers, metrics, m);
  addSpineBasics(layers, book, metrics, cream, cream, { rule: false, ornament: "✦" });
  return {
    version: 1,
    groups: [],
    palette: [],
    templateId: "bold",
    guides: [],
    background: { type: "solid", color: cream, gradient: coverFill(cream).gradient },
    layers,
    showGuides: true,
    showGrid: false,
    showBleed: true,
    showRulers: false,
  };
}

export function createCoverDocument(templateId: string, book: Book, cover: BookCoverDesign, options: CoverDocSeedOptions = {}): BookCoverDocument {
  const effectiveCover = options.pageCount ? { ...cover, pageCount: options.pageCount } : cover;
  const metrics = coverMetrics(book.trim_size, effectiveCover);
  const accent = options.accentColor || cover.accentColor || DEFAULT_ACCENT;
  if (templateId === "noir") return noirTemplate(book, effectiveCover, metrics, accent);
  if (templateId === "photo") return photoTemplate(book, effectiveCover, metrics, accent);
  if (templateId === "minimal") return minimalTemplate(book, effectiveCover, metrics, accent);
  if (templateId === "heritage") return heritageTemplate(book, effectiveCover, metrics, accent);
  if (templateId === "bold") return boldTemplate(book, effectiveCover, metrics, accent);
  return atelierTemplate(book, effectiveCover, metrics, accent);
}

export function createInitialCoverDocument(book: Book, cover: BookCoverDesign) {
  const templateId = cover.image ? "photo" : "atelier";
  return createCoverDocument(templateId, book, cover);
}

/* ------------------------------------------------------- DOM rendering */

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function coverTextStyle(layer: CoverTextLayer): Record<string, string | undefined> {
  const justify = layer.verticalAlign === "top" ? "flex-start" : layer.verticalAlign === "middle" ? "center" : "flex-end";
  const effect = layer.effect === "none" ? "" : layer.effect === "soft" ? `0 ${0.02}in ${0.08}in ${layer.effectColor}66` : layer.effect === "hard" ? `0.04in 0.04in 0 ${layer.effectColor}` : layer.effect === "glow" ? `0 0 0.18in ${layer.effectColor}` : "";
  return {
    display: "flex",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    justifyContent: justify,
    alignItems: layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start",
    textAlign: layer.align,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontFamily: coverFontCss(layer.fontFamily, layer.customFont),
    fontSize: `${layer.fontSize}pt`,
    fontWeight: String(layer.fontWeight),
    fontStyle: layer.italic ? "italic" : "normal",
    lineHeight: String(layer.lineHeight),
    letterSpacing: `${layer.letterSpacing}em`,
    color: layer.color,
    textShadow: effect,
    WebkitTextStroke: layer.effect === "outline" ? `${Math.max(0.3, layer.fontSize * 0.012)}pt ${layer.effectColor}` : undefined,
    textTransform: layer.uppercase ? "uppercase" : "none",
  };
}

function curvedTextSvg(layer: CoverTextLayer, content: string, idPrefix: string) {
  const width = Math.max(0.2, layer.width);
  const height = Math.max(0.2, layer.height);
  const curve = clamp(layer.curve, -100, 100);
  const fontSize = layer.fontSize / 72;
  const baseline = layer.verticalAlign === "top" ? height * 0.34 : layer.verticalAlign === "middle" ? height * 0.56 : height * 0.8;
  const sag = (curve / 100) * height * 0.32;
  const path = `M 0 ${roundInches(baseline)} Q ${roundInches(width / 2)} ${roundInches(baseline - sag * 2)} ${roundInches(width)} ${roundInches(baseline)}`;
  const anchor = layer.align === "left" || layer.align === "justify" ? "start" : layer.align === "right" ? "end" : "middle";
  const offset = anchor === "start" ? "0%" : anchor === "end" ? "100%" : "50%";
  const safeId = `${idPrefix}-${layer.id}-curve`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const effectStyle = layer.effect === "soft"
    ? `filter:drop-shadow(0 0.02in 0.08in ${layer.effectColor}66);`
    : layer.effect === "hard"
      ? `filter:drop-shadow(0.04in 0.04in 0 ${layer.effectColor});`
      : layer.effect === "glow"
        ? `filter:drop-shadow(0 0 0.18in ${layer.effectColor});`
        : "";
  const outline = layer.effect === "outline"
    ? `stroke="${escapeHtml(layer.effectColor)}" stroke-width="${Math.max(0.004, fontSize * 0.035)}" paint-order="stroke"`
    : "";
  const value = (layer.uppercase ? content.toLocaleUpperCase() : content).replace(/\s*\n+\s*/g, " ");
  const highlightColor = rgbaColor(layer.highlight.color, layer.highlight.opacity);
  const highlight = layer.highlight.enabled
    ? `<text font-family="${escapeHtml(coverFontCss(layer.fontFamily, layer.customFont))}" font-size="${roundInches(fontSize)}" font-weight="${layer.fontWeight}" font-style="${layer.italic ? "italic" : "normal"}" fill="${highlightColor}" stroke="${highlightColor}" stroke-width="${Math.max(0.004, layer.highlight.padding * 2)}" stroke-linejoin="round" letter-spacing="${layer.letterSpacing}em" text-anchor="${anchor}" dominant-baseline="middle" aria-hidden="true"><textPath href="#${safeId}" startOffset="${offset}">${escapeHtml(value)}</textPath></text>`
    : "";
  return `<svg class="cover-doc-curved-text" viewBox="0 0 ${roundInches(width)} ${roundInches(height)}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;width:100%;height:100%;overflow:visible">
    <path id="${safeId}" d="${path}" fill="none"/>
    ${highlight}
    <text font-family="${escapeHtml(coverFontCss(layer.fontFamily, layer.customFont))}" font-size="${roundInches(fontSize)}" font-weight="${layer.fontWeight}" font-style="${layer.italic ? "italic" : "normal"}" fill="${escapeHtml(layer.color)}" letter-spacing="${layer.letterSpacing}em" text-anchor="${anchor}" dominant-baseline="middle" style="${effectStyle}${layer.uppercase ? "text-transform:uppercase;" : ""}" ${outline}>
      <textPath href="#${safeId}" startOffset="${offset}">${escapeHtml(value)}</textPath>
    </text>
  </svg>`;
}

function shapeSvgMarkup(layer: CoverShapeLayer, layerId: string) {
  const gradientId = `${layerId}-gradient`;
  const patternId = `${layerId}-pattern`;
  const pattern = layer.fill.pattern ?? coverPattern(layer.fill.color);
  const fill = layer.fill.type === "none"
    ? "none"
    : layer.fill.type === "solid"
      ? layer.fill.color
      : layer.fill.type === "pattern"
        ? `url(#${patternId})`
        : `url(#${gradientId})`;
  const meta = gradientMeta(layer.fill.gradient);
  const stops = layer.fill.gradient.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stop) => `<stop offset="${Math.round(stop.position * 1000) / 10}%" stop-color="${stop.color}"/>`)
    .join("");
  const tileWidth = layer.width > 0 ? (pattern.scale / layer.width) * 100 : 10;
  const tileHeight = layer.height > 0 ? (pattern.scale / layer.height) * 100 : 10;
  const defs = layer.fill.type === "gradient"
    ? `<defs>${layer.fill.gradient.type === "radial" ? `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>` : `<linearGradient id="${gradientId}" x1="${meta.x1 * 100}%" y1="${meta.y1 * 100}%" x2="${meta.x2 * 100}%" y2="${meta.y2 * 100}%">${stops}</linearGradient>`}</defs>`
    : layer.fill.type === "pattern"
      ? `<defs><pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${tileWidth}" height="${tileHeight}" patternTransform="rotate(${pattern.angle} ${tileWidth / 2} ${tileHeight / 2})"><image href="${escapeHtml(coverPatternDataUrl(pattern))}" width="${tileWidth}" height="${tileHeight}" preserveAspectRatio="none"/></pattern></defs>`
      : "";
  const shapeUnit = Math.max(0.08, (layer.width + layer.height) / 2);
  const stroke = layer.strokeWidth > 0 ? `stroke="${layer.strokeColor}" stroke-width="${Math.max(0.2, layer.strokeWidth * 100 / shapeUnit)}"` : "";
  const dash = layer.dash === "dashed" ? `stroke-dasharray="4 3"` : layer.dash === "dotted" ? `stroke-dasharray="1 3"` : "";
  if (layer.shape === "rectangle") {
    return `<div style="width:100%;height:100%;border-radius:${layer.radius}in;background:${layer.fill.type === "none" ? "transparent" : coverFillCss(layer.fill)};${layer.strokeWidth > 0 ? `border:${layer.strokeWidth}in ${layer.dash === "solid" ? "solid" : layer.dash} ${layer.strokeColor};` : ""}"></div>`;
  }
  if (layer.shape === "ellipse") {
    return `<div style="width:100%;height:100%;border-radius:50%;background:${layer.fill.type === "none" ? "transparent" : coverFillCss(layer.fill)};${layer.strokeWidth > 0 ? `border:${layer.strokeWidth}in ${layer.dash === "solid" ? "solid" : layer.dash} ${layer.strokeColor};` : ""}"></div>`;
  }
  const path = coverShapePath(layer.shape);
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">${defs}<path d="${path}" fill="${fill}" ${stroke} ${dash}/></svg>`;
}

function clipImageMask(ctx: CanvasRenderingContext2D, mask: CoverImageMask, x: number, y: number, width: number, height: number, radius: number) {
  if (mask === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    return;
  }
  if (mask === "arch") {
    const r = Math.min(width / 2, height);
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.arc(x + width / 2, y + r, r, Math.PI, 0);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.clip();
    return;
  }
  if (mask === "diamond" || mask === "hexagon") {
    const points = mask === "diamond"
      ? [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]
      : [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]];
    ctx.beginPath();
    points.forEach(([px, py], index) => {
      const pointX = x + px * width;
      const pointY = y + py * height;
      if (index === 0) ctx.moveTo(pointX, pointY);
      else ctx.lineTo(pointX, pointY);
    });
    ctx.closePath();
    ctx.clip();
    return;
  }
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
}

export function coverLayerInnerHtml(book: Book, cover: BookCoverDesign, layer: CoverLayer, idPrefix = "cover") {
  if (layer.type === "text") {
    const content = resolveCoverTokenText(layer.text, book, cover);
    if (layer.curve !== 0) return curvedTextSvg(layer, content, idPrefix);
    const style = coverTextStyle(layer);
    const styleString = Object.entries(style).filter(([, value]) => value !== undefined).map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLocaleLowerCase()}`)}:${value}`).join(";");
    const value = escapeHtml(content) || "&#8203;";
    const highlighted = layer.highlight.enabled
      ? `<span class="cover-doc-text-highlight" style="display:block;width:fit-content;max-width:100%;box-sizing:border-box;background:${rgbaColor(layer.highlight.color, layer.highlight.opacity)};padding:${layer.highlight.padding}in ${layer.highlight.padding * 1.6}in;border-radius:${layer.highlight.radius}in;box-decoration-break:clone;-webkit-box-decoration-break:clone">${value}</span>`
      : value;
    return `<div class="cover-doc-text" style="${styleString}">${highlighted}</div>`;
  }
  if (layer.type === "image") {
    if (!layer.src) {
      return `<div class="cover-doc-image-empty"><span>Image</span></div>`;
    }
    const filter = coverImageFilterCss(layer);
    const tint = layer.tintStrength > 0
      ? `<span class="cover-doc-image-tint" style="position:absolute;inset:0;background:${escapeHtml(layer.tint)};opacity:${layer.tintStrength};mix-blend-mode:color;pointer-events:none"></span>`
      : "";
    return `<div class="cover-doc-image-frame" style="position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;border-radius:${layer.radius}in;${coverImageMaskCss(layer.mask)}"><img class="cover-doc-image" src="${escapeHtml(layer.src)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:${layer.fit};object-position:${Math.round(layer.focusX * 100)}% ${Math.round(layer.focusY * 100)}%;${filter ? `filter:${filter};` : ""}transform:scale(${layer.flipX ? -1 : 1},${layer.flipY ? -1 : 1})" />${tint}</div>`;
  }
  if (layer.type === "shape") {
    return shapeSvgMarkup(layer, `${idPrefix}-${layer.id}`);
  }
  if (layer.type === "line") {
    const background = layer.dash === "dashed"
      ? `repeating-linear-gradient(90deg, ${layer.color} 0 ${Math.max(0.06, layer.height * 2.2)}in, transparent ${Math.max(0.06, layer.height * 2.2)}in ${Math.max(0.12, layer.height * 3.8)}in)`
      : layer.dash === "dotted"
        ? `repeating-linear-gradient(90deg, ${layer.color} 0 ${layer.height}in, transparent ${layer.height}in ${layer.height * 2}in)`
        : layer.color;
    return `<div style="width:100%;height:100%;border-radius:99px;background:${background}"></div>`;
  }
  if (layer.type === "symbol") {
    return `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-family:'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols',serif;font-size:${Math.min(layer.width, layer.height) * 72}pt;line-height:1;color:${layer.color}">${escapeHtml(layer.glyph)}</div>`;
  }
  if (layer.type === "artwork") {
    const src = coverArtworkDataUrl(layer);
    return `<img class="cover-doc-artwork" src="${escapeHtml(src)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain" />`;
  }
  const isbn = cover.isbn.trim();
  if (cover.barcodeImage) {
    return `<div class="cover-doc-barcode" style="background:${layer.background};justify-content:center;padding:${Math.max(0.035, layer.height * 0.08)}in;">${layer.showText ? `<span class="cover-doc-barcode-label" style="font-size:${Math.max(5.2, Math.min(layer.width, layer.height) * 7.2)}pt;color:${layer.barColor}">${escapeHtml(isbn || "ISBN")}</span>` : ""}<img src="${escapeHtml(cover.barcodeImage)}" alt="Barcode" style="min-height:0;flex:1;width:100%;object-fit:contain"/></div>`;
  }
  const labelSize = Math.max(5.2, Math.min(layer.width, layer.height) * 7.2);
  return `<div class="cover-doc-barcode" style="background:${layer.background};color:${layer.barColor};justify-content:center;padding:${Math.max(0.035, layer.height * 0.08)}in;">
    ${layer.showText ? `<span class="cover-doc-barcode-label" style="font-size:${labelSize}pt;color:${layer.barColor}">${escapeHtml(isbn || "ISBN")}</span>` : ""}
    <span class="cover-doc-barcode-bars" style="flex:1;min-height:0;width:100%">${barcodeSvgMarkup(isbn, layer.barColor)}</span>
  </div>`;
}

function rgbaColor(value: string, opacity: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return value;
  const red = Number.parseInt(match[1].slice(0, 2), 16);
  const green = Number.parseInt(match[1].slice(2, 4), 16);
  const blue = Number.parseInt(match[1].slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.round(clamp(opacity, 0, 1) * 1000) / 1000})`;
}

export function coverLayerEffectsCss(layer: CoverLayer) {
  const filters: string[] = [];
  if (layer.shadow.enabled) filters.push(`drop-shadow(${layer.shadow.offsetX}in ${layer.shadow.offsetY}in ${layer.shadow.blur}in ${rgbaColor(layer.shadow.color, layer.shadow.opacity)})`);
  if (layer.glow.enabled) filters.push(`drop-shadow(0 0 ${layer.glow.blur}in ${rgbaColor(layer.glow.color, layer.glow.opacity)})`);
  return filters.join(" ");
}

function coverLayerEffectCanvas(layer: CoverLayer, dpi: number) {
  const filters: string[] = [];
  if (layer.shadow.enabled) filters.push(`drop-shadow(${Math.round(layer.shadow.offsetX * dpi * 100) / 100}px ${Math.round(layer.shadow.offsetY * dpi * 100) / 100}px ${Math.round(layer.shadow.blur * dpi * 100) / 100}px ${rgbaColor(layer.shadow.color, layer.shadow.opacity)})`);
  if (layer.glow.enabled) filters.push(`drop-shadow(0 0 ${Math.round(layer.glow.blur * dpi * 100) / 100}px ${rgbaColor(layer.glow.color, layer.glow.opacity)})`);
  return filters.join(" ");
}

export function coverLayerFadeCss(layer: Pick<CoverLayerBase, "fade">) {
  const mode = layer.fade.mode;
  const size = clamp(layer.fade.size, 0, 1);
  if (mode === "none" || size <= 0) return {};
  const amount = Math.round(size * 1000) / 10;
  const image = mode === "bottom"
    ? `linear-gradient(to top, transparent 0%, #000000 ${amount}%)`
    : mode === "top"
      ? `linear-gradient(to bottom, transparent 0%, #000000 ${amount}%)`
      : mode === "left"
        ? `linear-gradient(to right, transparent 0%, #000000 ${amount}%)`
        : mode === "right"
          ? `linear-gradient(to left, transparent 0%, #000000 ${amount}%)`
          : `radial-gradient(ellipse at center, #000000 ${100 - amount}%, transparent 100%)`;
  return { maskImage: image, WebkitMaskImage: image };
}

export function coverLayerFadeActive(layer: Pick<CoverLayerBase, "fade">) {
  return layer.fade.mode !== "none" && layer.fade.size > 0;
}

function applyLayerFadeCanvas(ctx: CanvasRenderingContext2D, fade: CoverLayerFade, width: number, height: number) {
  if (fade.mode === "none" || fade.size <= 0) return;
  const size = clamp(fade.size, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = fade.mode === "vignette"
    ? (() => {
        const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.72);
        gradient.addColorStop(0, "rgba(0,0,0,1)");
        gradient.addColorStop(1 - size, "rgba(0,0,0,1)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        return gradient;
      })()
    : (() => {
        const horizontal = fade.mode === "left" || fade.mode === "right";
        const gradient = horizontal ? ctx.createLinearGradient(0, 0, width, 0) : ctx.createLinearGradient(0, 0, 0, height);
        const stops: Array<[number, number]> = fade.mode === "bottom" || fade.mode === "right"
          ? [[0, 1], [1 - size, 1], [1, 0]]
          : [[0, 0], [size, 1], [1, 1]];
        stops.forEach(([position, alpha]) => gradient.addColorStop(position, `rgba(0,0,0,${alpha})`));
        return gradient;
      })();
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function coverLayerStyle(layer: CoverLayer): Record<string, string> {
  const style: Record<string, string> = {
    left: `${layer.panel === "wrap" ? layer.x : layer.x}in`,
    top: `${layer.y}in`,
    width: `${layer.width}in`,
    height: `${layer.height}in`,
    transform: `rotate(${layer.rotation}deg)`,
    opacity: String(layer.opacity),
    mixBlendMode: layer.blendMode,
  };
  const effects = coverLayerEffectsCss(layer);
  if (effects) style.filter = effects;
  Object.assign(style, coverLayerFadeCss(layer));
  return style;
}

let coverMarkupInstance = 0;

function layerMarkup(book: Book, cover: BookCoverDesign, layer: CoverLayer, offsetX: number, offsetY: number, clipped: boolean, instanceId: string) {
  const style = coverLayerStyle(layer);
  style.left = `${roundInches(layer.x - offsetX)}in`;
  style.top = `${roundInches(layer.y - offsetY)}in`;
  return `<div class="cover-doc-layer cover-doc-layer-${layer.type}${clipped ? " is-clipped" : ""}" data-layer-id="${escapeHtml(layer.id)}" style="${Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLocaleLowerCase()}`)}:${value}`).join(";")};transform-origin:50% 50%;position:absolute;${layer.locked ? "pointer-events:none;" : ""}">${coverLayerInnerHtml(book, cover, layer, instanceId)}</div>`;
}

export function coverDocMarkup(book: Book, cover: BookCoverDesign, panel: CoverPanel = "wrap", options: { guides?: boolean; className?: string; instanceId?: string } = {}) {
  const metrics = coverMetrics(book.trim_size, cover);
  const rect = coverPanelRect(metrics, panel);
  coverMarkupInstance += 1;
  const instanceId = options.instanceId ?? `cover-doc-${coverMarkupInstance}`;
  const backgroundLayer = `<div class="cover-doc-background" style="position:absolute;left:${-rect.x}in;top:${-rect.y}in;width:${metrics.fullWidth}in;height:${metrics.fullHeight}in;background:${coverFillCss(cover.doc.background)}"></div>`;
  const layers = cover.doc.layers.filter((layer) => layerForPanel(layer, panel) && coverLayerVisible(cover.doc, layer)).map((layer) => {
    const origin = layer.panel === "wrap" ? { x: 0, y: 0 } : coverPanelRect(metrics, layer.panel as Exclude<CoverPanel, "wrap">);
    const offsetX = rect.x - origin.x;
    const offsetY = rect.y - origin.y;
    return layerMarkup(book, cover, layer, offsetX, offsetY, false, instanceId);
  }).join("");
  const guides = options.guides && panel === "wrap" ? guideMarkup(metrics) : "";
  return `<div class="cover-doc cover-doc-panel-${panel} ${options.className ?? ""}" style="position:relative;width:${rect.width}in;height:${rect.height}in;overflow:hidden;isolation:isolate;background:${coverFillCss(cover.doc.background)}" data-panel="${panel}">${backgroundLayer}${layers}${guides}</div>`;
}

export function guideMarkup(metrics: CoverMetrics) {
  const safe = 0.25;
  return `<div class="cover-doc-guides" aria-hidden="true">
    <span class="cover-doc-guide trim" style="left:${metrics.bleed}in;top:${metrics.bleed}in;width:${metrics.trimWidthTotal}in;height:${metrics.trimHeight}in"></span>
    <span class="cover-doc-guide spine-a" style="left:${metrics.bleed + metrics.trimWidth}in;top:${metrics.bleed}in;height:${metrics.trimHeight}in"></span>
    <span class="cover-doc-guide spine-b" style="left:${metrics.bleed + metrics.trimWidth + metrics.spineWidth}in;top:${metrics.bleed}in;height:${metrics.trimHeight}in"></span>
    <span class="cover-doc-guide safe" style="left:${metrics.bleed + safe}in;top:${metrics.bleed + safe}in;width:${metrics.trimWidthTotal - safe * 2}in;height:${metrics.trimHeight - safe * 2}in"></span>
  </div>`;
}

export function coverDocCss() {
  return `
.cover-doc-page { display:flex; width:100%; justify-content:center; page-break-after:always; break-after:page; }
.cover-doc { position:relative; overflow:hidden; isolation:isolate; background-color:#f5efe4; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
.cover-doc-layer { position:absolute; transform-origin:50% 50%; }
.cover-doc-layer img { display:block; }
.cover-doc-text { min-width:0; }
.cover-doc-curved-text { display:block; }
.cover-doc-image-empty { display:flex; width:100%; height:100%; align-items:center; justify-content:center; border:1px dashed rgba(0,0,0,.24); background:rgba(0,0,0,.04); color:rgba(0,0,0,.38); font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:8pt; }
.cover-doc-barcode { display:flex; width:100%; height:100%; flex-direction:column; align-items:center; gap:.03in; border-radius:.03in; }
.cover-doc-barcode-label { display:block; max-width:100%; overflow:hidden; font-family:'Helvetica Neue',Arial,sans-serif; font-weight:600; letter-spacing:.04em; line-height:1.1; text-overflow:ellipsis; white-space:nowrap; }
.cover-doc-barcode-bars { display:flex; width:100%; min-height:0; align-items:stretch; }
.cover-doc-barcode-svg { display:block; width:100%; height:100%; }
.cover-doc-guides { position:absolute; inset:0; z-index:50; pointer-events:none; }
.cover-doc-guide { position:absolute; display:block; border:1px dashed rgba(255,255,255,.65); box-shadow:0 0 0 1px rgba(0,0,0,.22); }
.cover-doc-guide.spine-a, .cover-doc-guide.spine-b { width:0; border-width:0 0 0 1px; }
.cover-doc-guide.safe { border-color:rgba(255,203,112,.75); border-style:dotted; }
.cover-doc-page > .cover-doc { box-shadow:0 18px 50px rgba(0,0,0,.34); }
@media print { .cover-doc-page { page-break-after:always; } .cover-doc-page > .cover-doc { box-shadow:none; } }
`;
}

export function coverDocPageHtml(book: Book, cover: BookCoverDesign, panel: CoverPanel = "wrap") {
  const metrics = coverMetrics(book.trim_size, cover);
  const rect = coverPanelRect(metrics, panel);
  return `<section class="cover-doc-page" style="width:${rect.width}in;height:${rect.height}in;">${coverDocMarkup(book, cover, panel)}</section>`;
}

export function coverDocPageRule(book: Book, cover: BookCoverDesign) {
  const metrics = coverMetrics(book.trim_size, cover);
  return `@page book-cover { size: ${metrics.fullWidth}in ${metrics.fullHeight}in; margin: 0; }`;
}

export function coverDocPanelLabel(panel: CoverPanel) {
  return panel === "wrap" ? "Full wrap" : panel === "front" ? "Front cover" : panel === "back" ? "Back cover" : "Spine";
}

/* ------------------------------------------------------------ canvas export */

type ExportTarget = CoverPanel;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function patternForFill(ctx: CanvasRenderingContext2D, fill: CoverFill, images?: Map<string, HTMLImageElement | null>) {
  if (fill.type !== "pattern") return null;
  const pattern = fill.pattern ?? coverPattern(fill.color);
  const image = images?.get(coverPatternDataUrl(pattern));
  if (!image) return null;
  const canvasPattern = ctx.createPattern(image, "repeat");
  if (canvasPattern && typeof DOMMatrix !== "undefined") canvasPattern.setTransform(new DOMMatrix().scale(1 / 96));
  return canvasPattern;
}

function applyFill(ctx: CanvasRenderingContext2D, fill: CoverFill, x: number, y: number, width: number, height: number, images?: Map<string, HTMLImageElement | null>) {
  if (fill.type === "none") return;
  if (fill.type === "solid") {
    ctx.fillStyle = fill.color;
  } else if (fill.type === "pattern") {
    const pattern = patternForFill(ctx, fill, images);
    ctx.fillStyle = pattern ?? (fill.pattern ?? coverPattern(fill.color)).background;
  } else {
    const meta = gradientMeta(fill.gradient);
    const gradient = fill.gradient.type === "radial"
      ? ctx.createRadialGradient(x + width / 2, y + height / 2, 0, x + width / 2, y + height / 2, Math.max(width, height) / 2)
      : ctx.createLinearGradient(x + meta.x1 * width, y + meta.y1 * height, x + meta.x2 * width, y + meta.y2 * height);
    fill.gradient.stops.slice().sort((a, b) => a.position - b.position).forEach((stop) => gradient.addColorStop(clamp(stop.position, 0, 1), stop.color));
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(x, y, width, height);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawImageFit(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, fit: "cover" | "contain", radius: number, options: { focusX?: number; focusY?: number; mask?: CoverImageMask; flipX?: boolean; flipY?: boolean; filter?: string; tint?: string; tintStrength?: number } = {}) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (fit === "cover" ? imageRatio > boxRatio : imageRatio < boxRatio) {
    drawWidth = height * imageRatio;
  } else {
    drawHeight = width / imageRatio;
  }
  const focusX = clamp(options.focusX ?? 0.5, 0, 1);
  const focusY = clamp(options.focusY ?? 0.5, 0, 1);
  const extraX = Math.max(0, drawWidth - width);
  const extraY = Math.max(0, drawHeight - height);
  const dx = fit === "cover" ? x - extraX * focusX : x + (width - drawWidth) / 2;
  const dy = fit === "cover" ? y - extraY * focusY : y + (height - drawHeight) / 2;
  ctx.save();
  clipImageMask(ctx, options.mask ?? "none", x, y, width, height, radius);
  if (options.filter) ctx.filter = options.filter;
  if (options.flipX || options.flipY) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
    ctx.translate(-(x + width / 2), -(y + height / 2));
  }
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  ctx.filter = "none";
  if (options.tint && (options.tintStrength ?? 0) > 0) {
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = clamp(options.tintStrength ?? 0, 0, 1);
    ctx.fillStyle = options.tint;
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function fillStyleFor(ctx: CanvasRenderingContext2D, fill: CoverFill, x: number, y: number, width: number, height: number, images?: Map<string, HTMLImageElement | null>): string | CanvasGradient | CanvasPattern {
  if (fill.type === "solid") return fill.color;
  if (fill.type === "pattern") return patternForFill(ctx, fill, images) ?? (fill.pattern ?? coverPattern(fill.color)).background;
  const meta = gradientMeta(fill.gradient);
  const gradient = fill.gradient.type === "radial"
    ? ctx.createRadialGradient(x + width / 2, y + height / 2, 0, x + width / 2, y + height / 2, Math.max(width, height) / 2)
    : ctx.createLinearGradient(x + meta.x1 * width, y + meta.y1 * height, x + meta.x2 * width, y + meta.y2 * height);
  fill.gradient.stops.slice().sort((a, b) => a.position - b.position).forEach((stop) => gradient.addColorStop(clamp(stop.position, 0, 1), stop.color));
  return gradient;
}

function drawShape(ctx: CanvasRenderingContext2D, layer: CoverShapeLayer, x: number, y: number, width: number, height: number, patternImages?: Map<string, HTMLImageElement | null>) {
  const fill = layer.fill;
  if (fill.type !== "none") ctx.fillStyle = fillStyleFor(ctx, fill, x, y, width, height, patternImages);
  if (layer.shape === "rectangle" || layer.shape === "ellipse") {
    if (layer.shape === "rectangle") {
      roundRectPath(ctx, x, y, width, height, layer.radius);
    } else {
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    }
    if (fill.type !== "none") ctx.fill();
    if (layer.strokeWidth > 0) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      ctx.setLineDash(layer.dash === "dashed" ? [layer.strokeWidth * 4, layer.strokeWidth * 3] : layer.dash === "dotted" ? [layer.strokeWidth, layer.strokeWidth * 2] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    return;
  }
  const path = new Path2D(coverShapePath(layer.shape));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 100, height / 100);
  if (fill.type !== "none") {
    ctx.fillStyle = fillStyleFor(ctx, fill, 0, 0, 100, 100, patternImages);
    ctx.fill(path);
  }
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.strokeColor;
    ctx.lineWidth = Math.max(layer.strokeWidth * 100 / Math.max(0.08, (width + height) / 2), 0.2);
    ctx.setLineDash(layer.dash === "dashed" ? [4, 3] : layer.dash === "dotted" ? [1, 3] : []);
    ctx.stroke(path);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: CoverTextLayer, content: string, width: number, height: number) {
  const fontSize = layer.fontSize / 72;
  const lineHeight = fontSize * layer.lineHeight;
  ctx.font = `${layer.italic ? "italic " : ""}${layer.fontWeight} ${fontSize}px ${coverFontCss(layer.fontFamily, layer.customFont)}`;
  ctx.textBaseline = "top";
  ctx.textAlign = layer.align === "center" ? "center" : layer.align === "right" ? "right" : "left";
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${layer.letterSpacing * fontSize}px`;
  }
  const value = layer.uppercase ? content.toLocaleUpperCase() : content;
  const lines = wrapCanvasText(ctx, value, width);
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const startY = layer.verticalAlign === "middle" ? (height - totalHeight) / 2 + (lineHeight - fontSize) / 2 : layer.verticalAlign === "bottom" ? height - totalHeight + (lineHeight - fontSize) / 2 : 0;
  const x = layer.align === "center" ? width / 2 : layer.align === "right" ? width : 0;
  if (layer.highlight.enabled) {
    const pad = Math.max(0, layer.highlight.padding);
    ctx.save();
    ctx.fillStyle = rgbaColor(layer.highlight.color, layer.highlight.opacity);
    lines.forEach((line, index) => {
      const textWidth = ctx.measureText(line).width;
      const left = layer.align === "center" ? width / 2 - textWidth / 2 : layer.align === "right" ? width - textWidth : 0;
      const y = startY + index * lineHeight;
      const boxX = left - pad * 1.6;
      const boxW = textWidth + pad * 3.2;
      const boxY = y - pad + (lineHeight - fontSize) / 2;
      const boxH = fontSize + pad * 2;
      roundRectPath(ctx, boxX, boxY, Math.max(0.01, boxW), Math.max(0.01, boxH), Math.min(layer.highlight.radius, boxH / 2));
      ctx.fill();
    });
    ctx.restore();
  }
  if (layer.effect === "soft" || layer.effect === "hard" || layer.effect === "glow") {
    ctx.shadowColor = layer.effectColor;
    ctx.shadowBlur = layer.effect === "soft" ? 0.08 : layer.effect === "glow" ? 0.18 : 0;
    ctx.shadowOffsetX = layer.effect === "hard" ? 0.04 : 0;
    ctx.shadowOffsetY = layer.effect === "hard" ? 0.04 : 0;
  }
  ctx.fillStyle = layer.color;
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (layer.effect === "outline") {
      ctx.strokeStyle = layer.effectColor;
      ctx.lineWidth = Math.max(0.005, fontSize * 0.012);
      ctx.strokeText(line, x, y);
    }
    ctx.fillText(line, x, y);
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawCurvedTextLayer(ctx: CanvasRenderingContext2D, layer: CoverTextLayer, content: string, width: number, height: number) {
  const fontSize = layer.fontSize / 72;
  const value = (layer.uppercase ? content.toLocaleUpperCase() : content).replace(/\s*\n+\s*/g, " ").trim();
  if (!value) return;
  ctx.font = `${layer.italic ? "italic " : ""}${layer.fontWeight} ${fontSize}px ${coverFontCss(layer.fontFamily, layer.customFont)}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  const tracking = layer.letterSpacing * fontSize;
  const chars = Array.from(value);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, item) => sum + item, 0) + tracking * Math.max(0, chars.length - 1);
  const baseline = layer.verticalAlign === "top" ? height * 0.34 : layer.verticalAlign === "middle" ? height * 0.56 : height * 0.8;
  const sag = (layer.curve / 100) * height * 0.32;
  const p0 = { x: 0, y: baseline };
  const p1 = { x: width / 2, y: baseline - sag * 2 };
  const p2 = { x: width, y: baseline };
  const samples = 100;
  const points: Array<{ x: number; y: number; angle: number }> = [];
  const cumulative: number[] = [0];
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    points.push({ x, y, angle: Math.atan2(dy, dx) });
    if (index > 0) cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  const pathLength = cumulative[cumulative.length - 1];
  let cursor = layer.align === "center" ? (pathLength - total) / 2 : layer.align === "right" ? pathLength - total : 0;
  const tForDistance = (distance: number) => {
    let index = 0;
    while (index < cumulative.length - 2 && cumulative[index + 1] < distance) index += 1;
    const span = cumulative[index + 1] - cumulative[index] || 1;
    return Math.min(1, Math.max(0, (index + (distance - cumulative[index]) / span) / samples));
  };
  if (layer.highlight.enabled) {
    const highlightColor = rgbaColor(layer.highlight.color, layer.highlight.opacity);
    let markerCursor = cursor;
    ctx.save();
    ctx.fillStyle = highlightColor;
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = Math.max(0.004, layer.highlight.padding * 2);
    ctx.lineJoin = "round";
    chars.forEach((char, index) => {
      const distance = markerCursor + widths[index] / 2;
      const t = tForDistance(distance);
      const point = points[Math.round(t * samples)];
      if (point) {
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(point.angle);
        ctx.fillText(char, 0, 0);
        if (layer.highlight.padding > 0) ctx.strokeText(char, 0, 0);
        ctx.restore();
      }
      markerCursor += widths[index] + tracking;
    });
    ctx.restore();
  }
  if (layer.effect === "soft" || layer.effect === "hard" || layer.effect === "glow") {
    ctx.shadowColor = layer.effectColor;
    ctx.shadowBlur = layer.effect === "soft" ? 0.08 : layer.effect === "glow" ? 0.18 : 0;
    ctx.shadowOffsetX = layer.effect === "hard" ? 0.04 : 0;
    ctx.shadowOffsetY = layer.effect === "hard" ? 0.04 : 0;
  }
  ctx.fillStyle = layer.color;
  chars.forEach((char, index) => {
    const distance = cursor + widths[index] / 2;
    const t = tForDistance(distance);
    const pointIndex = Math.round(t * samples);
    const point = points[pointIndex];
    if (!point) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    if (layer.effect === "outline") {
      ctx.strokeStyle = layer.effectColor;
      ctx.lineWidth = Math.max(0.005, fontSize * 0.012);
      ctx.strokeText(char, 0, 0);
    }
    ctx.fillText(char, 0, 0);
    ctx.restore();
    cursor += widths[index] + tracking;
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawBarcodeLayer(ctx: CanvasRenderingContext2D, layer: CoverBarcodeLayer, cover: BookCoverDesign, width: number, height: number, barcodeImage: HTMLImageElement | null) {
  ctx.fillStyle = layer.background;
  roundRectPath(ctx, 0, 0, width, height, 0.03);
  ctx.fill();
  const pad = Math.max(0.035, height * 0.08);
  const label = (cover.isbn || "ISBN").toUpperCase();
  const labelSize = Math.max(0.07, Math.min(width, height) * 0.1);
  let barY = pad;
  let barHeight = height - pad * 2;
  if (layer.showText) {
    ctx.fillStyle = layer.barColor;
    ctx.font = `600 ${labelSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, width / 2, pad * 0.72);
    barY = pad * 0.72 + labelSize * 1.35;
    barHeight = height - barY - pad * 0.72;
  }
  if (barcodeImage) {
    drawImageFit(ctx, barcodeImage, pad, barY, width - pad * 2, barHeight, "contain", 0);
    return;
  }
  const bits = ean13Bits(cover.isbn);
  if (bits) {
    const module = (width - pad * 2) / 113;
    ctx.fillStyle = layer.barColor;
    let runStart = -1;
    for (let index = 0; index <= bits.length; index += 1) {
      const filled = bits[index] === "1";
      if (filled && runStart < 0) runStart = index;
      if (!filled && runStart >= 0) {
        ctx.fillRect(pad + (9 + runStart) * module, barY, (index - runStart) * module, barHeight);
        runStart = -1;
      }
    }
  } else {
    ctx.fillStyle = layer.barColor;
    ctx.globalAlpha = 0.22;
    for (let index = 0; index < 62; index += 1) {
      const x = pad + (index / 62) * (width - pad * 2);
      ctx.fillRect(x, barY, (index % 3 === 0 ? 0.8 : 0.42) * ((width - pad * 2) / 95), barHeight);
    }
    ctx.globalAlpha = 1;
  }
}

export interface CoverCanvasOptions {
  dpi?: number;
  bleed?: boolean;
  marks?: boolean;
  slug?: number;
  watermark?: boolean;
}

function drawProductionMarks(ctx: CanvasRenderingContext2D, book: Book, cover: BookCoverDesign, metrics: CoverMetrics, slug: number) {
  const left = metrics.bleed;
  const top = metrics.bleed;
  const right = left + metrics.trimWidthTotal;
  const bottom = top + metrics.trimHeight;
  const gap = 0.055;
  const length = 0.14;
  ctx.save();
  ctx.strokeStyle = "#101010";
  ctx.lineWidth = 0.004;
  ctx.lineCap = "butt";
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  for (const y of [top, bottom]) {
    line(left - gap - length, y, left - gap, y);
    line(right + gap, y, right + gap + length, y);
  }
  for (const x of [left, right]) {
    line(x, top - gap - length, x, top - gap);
    line(x, bottom + gap, x, bottom + gap + length);
  }
  for (const x of [left + metrics.trimWidth, left + metrics.trimWidth + metrics.spineWidth]) {
    line(x, top - gap - length, x, top - gap);
    line(x, bottom + gap, x, bottom + gap + length);
  }

  const swatches = ["#00aeef", "#ec008c", "#fff200", "#111111", "#808080", "#c0c0c0", "#f4f1ea"];
  const swatchWidth = 0.105;
  const swatchHeight = Math.max(0.045, slug - gap - 0.035);
  const swatchY = bottom + gap + 0.012;
  swatches.forEach((swatch, index) => {
    ctx.fillStyle = swatch;
    ctx.fillRect(left + index * swatchWidth, swatchY, swatchWidth - 0.006, swatchHeight);
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = 0.0035;
    ctx.strokeRect(left + index * swatchWidth, swatchY, swatchWidth - 0.006, swatchHeight);
  });

  const label = `PRINT-READY WRAP  ·  ${book.title || "Untitled"}${book.author ? `  ·  ${book.author}` : ""}  ·  trim ${metrics.trimWidthTotal} × ${metrics.trimHeight} in  ·  spine ${metrics.spineWidth} in  ·  ${cover.pageCount.toLocaleString()} pages  ·  bleed ${cover.bleed} in`;
  ctx.fillStyle = "#101010";
  ctx.font = `0.052px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const textX = left + swatches.length * swatchWidth + 0.12;
  ctx.fillText(label, textX, swatchY + swatchHeight / 2, Math.max(0.4, metrics.fullWidth + slug - textX - 0.1));

  ctx.font = `600 0.06px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("BACK", left + metrics.trimWidth / 2, -slug / 2);
  ctx.fillText("SPINE", left + metrics.trimWidth + metrics.spineWidth / 2, -slug / 2);
  ctx.fillText("FRONT", left + metrics.trimWidth + metrics.spineWidth + metrics.trimWidth / 2, -slug / 2);
  ctx.restore();
}

function drawProofWatermark(ctx: CanvasRenderingContext2D, rect: CoverPanelRect) {
  const text = "PROOF";
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#111111";
  ctx.font = "700 0.38px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepX = 4.1;
  const stepY = 2.4;
  for (let y = rect.y + 1.3; y < rect.y + rect.height; y += stepY) {
    for (let x = rect.x + 1.2; x < rect.x + rect.width; x += stepX) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 9);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

export async function renderCoverCanvas(book: Book, cover: BookCoverDesign, target: ExportTarget = "wrap", options: CoverCanvasOptions = {}) {
  if (typeof document === "undefined") throw new Error("Cover rendering is only available in the app.");
  const metrics = coverMetrics(book.trim_size, cover);
  const slug = options.marks && target === "wrap" ? Math.max(0.15, options.slug ?? 0.25) : 0;
  const rect = slug > 0
    ? { x: -slug, y: -slug, width: metrics.fullWidth + slug * 2, height: metrics.fullHeight + slug * 2 }
    : target === "wrap" && options.bleed === false
      ? { x: metrics.bleed, y: metrics.bleed, width: metrics.trimWidthTotal, height: metrics.trimHeight }
      : coverPanelRect(metrics, target);
  const dpi = clamp(options.dpi ?? 300, 72, 450);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * dpi));
  canvas.height = Math.max(1, Math.round(rect.height * dpi));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.scale(dpi, dpi);
  ctx.translate(-rect.x, -rect.y);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  const patternSources = new Set<string>();
  const addPatternSource = (fill: CoverFill) => {
    if (fill.type === "pattern") patternSources.add(coverPatternDataUrl(fill.pattern ?? coverPattern(fill.color)));
  };
  addPatternSource(cover.doc.background);
  for (const layer of cover.doc.layers) if (layer.type === "shape") addPatternSource(layer.fill);
  const imageSources = cover.doc.layers
    .flatMap((layer) => layer.type === "image" && layer.src ? [layer.src] : layer.type === "artwork" ? [coverArtworkDataUrl(layer)] : []);
  const patternList = [...patternSources];
  const [images, patternImages] = await Promise.all([
    Promise.all(imageSources.map(loadImage)),
    Promise.all(patternList.map(loadImage)),
  ]);
  const imageBySource = new Map(imageSources.map((source, index) => [source, images[index]]));
  const patternBySource = new Map(patternList.map((source, index) => [source, patternImages[index]]));
  const barcodeImage = cover.barcodeImage ? await loadImage(cover.barcodeImage) : null;
  applyFill(ctx, cover.doc.background, 0, 0, metrics.fullWidth, metrics.fullHeight, patternBySource);
  const layers = cover.doc.layers.filter((layer) => coverLayerVisible(cover.doc, layer) && layerForPanel(layer, target));
  const drawLayerContent = (target: CanvasRenderingContext2D, layer: CoverLayer, spread: CoverPanelRect, imageFilter: string) => {
    if (layer.type === "text") {
      const content = resolveCoverTokenText(layer.text, book, cover);
      if (layer.curve !== 0) drawCurvedTextLayer(target, layer, content, spread.width, spread.height);
      else drawTextLayer(target, layer, content, spread.width, spread.height);
    } else if (layer.type === "image") {
      const image = imageBySource.get(layer.src);
      if (image) {
        target.filter = "none";
        drawImageFit(target, image, 0, 0, spread.width, spread.height, layer.fit, layer.radius, {
          focusX: layer.focusX,
          focusY: layer.focusY,
          mask: layer.mask,
          flipX: layer.flipX,
          flipY: layer.flipY,
          filter: imageFilter,
          tint: layer.tint,
          tintStrength: layer.tintStrength,
        });
      } else {
        target.fillStyle = "rgba(0,0,0,.08)";
        roundRectPath(target, 0, 0, spread.width, spread.height, layer.radius);
        target.fill();
      }
    } else if (layer.type === "shape") {
      drawShape(target, layer, 0, 0, spread.width, spread.height, patternBySource);
    } else if (layer.type === "line") {
      target.fillStyle = layer.color;
      if (layer.dash === "solid") {
        target.fillRect(0, 0, spread.width, spread.height);
      } else {
        target.setLineDash(layer.dash === "dashed" ? [Math.max(0.06, spread.height * 2.2), Math.max(0.05, spread.height * 1.6)] : [spread.height, spread.height]);
        target.lineWidth = spread.height;
        target.strokeStyle = layer.color;
        target.beginPath();
        target.moveTo(0, spread.height / 2);
        target.lineTo(spread.width, spread.height / 2);
        target.stroke();
        target.setLineDash([]);
      }
    } else if (layer.type === "symbol") {
      const size = Math.min(spread.width, spread.height);
      target.fillStyle = layer.color;
      target.font = `${size * 0.92}px 'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols',serif`;
      target.textAlign = "center";
      target.textBaseline = "middle";
      target.fillText(layer.glyph, spread.width / 2, spread.height / 2);
    } else if (layer.type === "artwork") {
      const image = imageBySource.get(coverArtworkDataUrl(layer));
      if (image) drawImageFit(target, image, 0, 0, spread.width, spread.height, "contain", 0);
    } else {
      drawBarcodeLayer(target, layer, cover, spread.width, spread.height, barcodeImage);
    }
  };

  for (const layer of layers) {
    const spread = layerSpreadRect(metrics, layer);
    if (spread.x + spread.width < rect.x || spread.x > rect.x + rect.width || spread.y + spread.height < rect.y || spread.y > rect.y + rect.height) continue;
    const effectFilter = coverLayerEffectCanvas(layer, dpi);
    const imageGrade = layer.type === "image" ? coverImageFilterCanvas(layer, dpi) : "";
    const masked = coverLayerFadeActive(layer);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode === "normal" ? "source-over" : layer.blendMode as GlobalCompositeOperation;
    if (!masked && effectFilter) ctx.filter = effectFilter;
    const centerX = spread.x + spread.width / 2;
    const centerY = spread.y + spread.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-spread.width / 2, -spread.height / 2);
    if (masked) {
      const pixelWidth = Math.max(1, Math.round(spread.width * dpi));
      const pixelHeight = Math.max(1, Math.round(spread.height * dpi));
      const layerCanvas = document.createElement("canvas");
      layerCanvas.width = pixelWidth;
      layerCanvas.height = pixelHeight;
      const layerCtx = layerCanvas.getContext("2d");
      if (layerCtx) {
        layerCtx.scale(pixelWidth / spread.width, pixelHeight / spread.height);
        drawLayerContent(layerCtx, layer, spread, imageGrade);
        applyLayerFadeCanvas(layerCtx, layer.fade, spread.width, spread.height);
        if (effectFilter) ctx.filter = effectFilter;
        ctx.drawImage(layerCanvas, 0, 0, spread.width, spread.height);
      }
    } else {
      drawLayerContent(ctx, layer, spread, [effectFilter, imageGrade].filter(Boolean).join(" "));
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (options.watermark) drawProofWatermark(ctx, rect);
  if (slug > 0) drawProductionMarks(ctx, book, cover, metrics, slug);
  return canvas;
}

export function coverExportFilename(book: Book, target: ExportTarget, extension: string) {
  const title = (book.title || "untitled").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "untitled";
  const label = target === "wrap" ? "full-wrap" : target;
  return `${title}-cover-${label}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function saveCoverBlob(blob: Blob, filename: string) {
  const tauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (tauri) {
    try {
      const [{ save }, { writeFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const extension = filename.split(".").pop() ?? "png";
      const path = await save({ defaultPath: filename, filters: [{ name: extension.toLocaleUpperCase() === "JPG" ? "JPEG image" : "PNG image", extensions: [extension] }] });
      if (!path) return null;
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
      return path;
    } catch {
      // Fall through to the webview downloader if the native dialog is unavailable.
    }
  }
  downloadBlob(blob, filename);
  return filename;
}

export async function downloadCoverFile(book: Book, cover: BookCoverDesign, target: ExportTarget, options: { dpi?: number; format?: "png" | "jpeg"; bleed?: boolean; watermark?: boolean } = {}) {
  const canvas = await renderCoverCanvas(book, cover, target, options);
  const format = options.format ?? "png";
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.94));
  if (!blob) throw new Error("The cover image could not be generated.");
  const filename = coverExportFilename(book, target, format === "jpeg" ? "jpg" : "png");
  return saveCoverBlob(blob, filename);
}

export async function coverPreviewDataUrl(book: Book, cover: BookCoverDesign, target: ExportTarget = "wrap") {
  const canvas = await renderCoverCanvas(book, cover, target, { dpi: 150 });
  return canvas.toDataURL("image/jpeg", 0.9);
}
