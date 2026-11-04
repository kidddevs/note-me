import {
  parseCoverDocument,
  type CoverBlendMode,
  type CoverDashStyle,
  type CoverFill,
  type CoverImageMask,
  type CoverLayer,
  type CoverLayerFade,
  type CoverLayerGlow,
  type CoverLayerShadow,
  type CoverLayerType,
  type CoverTextAlign,
  type CoverTextEffect,
  type CoverTextHighlight,
  type CoverTextLayer,
  type CoverVerticalAlign,
} from "./bookCoverDoc";

export const SAVED_COVER_STYLES_KEY = "book-studio:cover-styles:v1";
export const MAX_SAVED_COVER_STYLES = 30;
export const MAX_SAVED_COVER_STYLE_NAME = 48;

export interface CoverLayerStyleValues {
  opacity: number;
  blendMode: CoverBlendMode;
  shadow: CoverLayerShadow;
  glow: CoverLayerGlow;
  fade: CoverLayerFade;
  fontFamily?: CoverTextLayer["fontFamily"];
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  align?: CoverTextAlign;
  verticalAlign?: CoverVerticalAlign;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  uppercase?: boolean;
  effect?: CoverTextEffect;
  effectColor?: string;
  curve?: number;
  highlight?: CoverTextHighlight;
  fill?: CoverFill;
  radius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  dash?: CoverDashStyle;
  fit?: "cover" | "contain";
  grayscale?: boolean;
  sepia?: boolean;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  blur?: number;
  tint?: string;
  tintStrength?: number;
  mask?: CoverImageMask;
  showText?: boolean;
  barColor?: string;
  background?: string;
}

export interface CoverLayerStylePreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceType: CoverLayerType;
  values: CoverLayerStyleValues;
}

const SHARED_KEYS: (keyof CoverLayerStyleValues)[] = ["opacity", "blendMode", "shadow", "glow", "fade"];

const TYPE_KEYS: Record<CoverLayerType, (keyof CoverLayerStyleValues)[]> = {
  text: ["fontFamily", "fontSize", "fontWeight", "italic", "align", "verticalAlign", "lineHeight", "letterSpacing", "color", "uppercase", "effect", "effectColor", "curve", "highlight"],
  shape: ["fill", "radius", "strokeColor", "strokeWidth", "dash"],
  image: ["fit", "radius", "grayscale", "sepia", "brightness", "contrast", "saturation", "hue", "blur", "tint", "tintStrength", "mask"],
  line: ["color"],
  symbol: ["color"],
  artwork: ["color"],
  barcode: ["showText", "barColor", "background"],
};

const LAYER_TYPES: CoverLayerType[] = ["text", "image", "shape", "line", "symbol", "artwork", "barcode"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newStyleId() {
  return `cover-style-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function text(value: unknown, fallback = "", maximum = 240) {
  return typeof value === "string" ? value.slice(0, maximum) : fallback;
}

function timestamp(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

/** Extracts only reusable appearance values, never content, geometry, or identity. */
export function styleValuesFromLayer(layer: CoverLayer): CoverLayerStyleValues {
  const values: CoverLayerStyleValues = {
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    shadow: cloneValue(layer.shadow),
    glow: cloneValue(layer.glow),
    fade: cloneValue(layer.fade),
  };
  for (const key of TYPE_KEYS[layer.type]) {
    const value = (layer as unknown as Record<string, unknown>)[key];
    if (value !== undefined) (values as unknown as Record<string, unknown>)[key] = cloneValue(value);
  }
  return values;
}

/** Builds a type-safe patch; shared appearance always applies and matching type fields follow. */
export function applyLayerStyle(layer: CoverLayer, values: CoverLayerStyleValues): Partial<CoverLayer> {
  const patch: Record<string, unknown> = {};
  for (const key of SHARED_KEYS) {
    const value = values[key];
    if (value !== undefined) patch[key] = cloneValue(value);
  }
  for (const key of TYPE_KEYS[layer.type]) {
    const value = values[key];
    if (value !== undefined) patch[key] = cloneValue(value);
  }
  return patch as Partial<CoverLayer>;
}

function normalizeStyleValues(sourceType: CoverLayerType, raw: unknown): CoverLayerStyleValues | null {
  if (!isRecord(raw)) return null;
  const base = {
    id: "style-probe",
    type: sourceType,
    name: "Style probe",
    panel: "front",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    text: "",
    src: "",
    glyph: "✦",
    graphicId: "",
    ...raw,
  };
  const doc = parseCoverDocument({ layers: [base] });
  const layer = doc.layers[0];
  if (!layer || layer.type !== sourceType) return null;
  return styleValuesFromLayer(layer);
}

export function createLayerStylePreset(name: string, layer: CoverLayer, now = new Date()): CoverLayerStylePreset {
  const stamp = now.toISOString();
  const trimmed = text(name, "", MAX_SAVED_COVER_STYLE_NAME).trim();
  return {
    id: newStyleId(),
    name: trimmed || `${layer.name || layer.type} style`,
    createdAt: stamp,
    updatedAt: stamp,
    sourceType: layer.type,
    values: styleValuesFromLayer(layer),
  };
}

function parseLayerStyleEntry(value: unknown, stamp: string): CoverLayerStylePreset | null {
  if (!isRecord(value)) return null;
  const sourceType = LAYER_TYPES.includes(value.sourceType as CoverLayerType) ? value.sourceType as CoverLayerType : null;
  if (!sourceType) return null;
  const values = normalizeStyleValues(sourceType, value.values);
  if (!values) return null;
  const name = text(value.name, "", MAX_SAVED_COVER_STYLE_NAME).trim();
  if (!name) return null;
  return {
    id: text(value.id, "", 120).trim() || newStyleId(),
    name,
    createdAt: timestamp(value.createdAt, stamp),
    updatedAt: timestamp(value.updatedAt, stamp),
    sourceType,
    values,
  };
}

export function parseLayerStylePresets(value: unknown, now = new Date()): CoverLayerStylePreset[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = undefined;
    }
  }
  if (!Array.isArray(parsed)) return [];
  const stamp = now.toISOString();
  const seen = new Set<string>();
  const presets: CoverLayerStylePreset[] = [];
  for (const entry of parsed) {
    const preset = parseLayerStyleEntry(entry, stamp);
    if (!preset) continue;
    if (seen.has(preset.id)) preset.id = newStyleId();
    seen.add(preset.id);
    presets.push(preset);
    if (presets.length >= MAX_SAVED_COVER_STYLES) break;
  }
  return presets;
}

export function serializeLayerStylePresets(presets: CoverLayerStylePreset[]) {
  return JSON.stringify(presets.slice(0, MAX_SAVED_COVER_STYLES));
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface CoverStyleWriteResult {
  ok: boolean;
  presets: CoverLayerStylePreset[];
  message?: string;
}

export function readLayerStylePresets(): CoverLayerStylePreset[] {
  const store = storage();
  if (!store) return [];
  try {
    return parseLayerStylePresets(store.getItem(SAVED_COVER_STYLES_KEY));
  } catch {
    return [];
  }
}

export function writeLayerStylePresets(presets: CoverLayerStylePreset[]): CoverStyleWriteResult {
  const store = storage();
  const sifted = presets.slice(0, MAX_SAVED_COVER_STYLES);
  if (!store) return { ok: false, presets: sifted, message: "Style storage is unavailable in this environment." };
  try {
    store.setItem(SAVED_COVER_STYLES_KEY, serializeLayerStylePresets(sifted));
    return { ok: true, presets: sifted };
  } catch {
    return { ok: false, presets: sifted, message: "Styles couldn't be saved because local storage is full." };
  }
}

export function saveLayerStylePreset(name: string, layer: CoverLayer, presets = readLayerStylePresets()): CoverStyleWriteResult {
  return writeLayerStylePresets([createLayerStylePreset(name, layer), ...presets]);
}

export function renameLayerStylePreset(id: string, name: string, presets = readLayerStylePresets(), now = new Date()): CoverStyleWriteResult {
  const trimmed = text(name, "", MAX_SAVED_COVER_STYLE_NAME).trim();
  if (!trimmed) return { ok: true, presets };
  return writeLayerStylePresets(presets.map((preset) => preset.id === id ? { ...preset, name: trimmed, updatedAt: now.toISOString() } : preset));
}

export function deleteLayerStylePreset(id: string, presets = readLayerStylePresets()): CoverStyleWriteResult {
  return writeLayerStylePresets(presets.filter((preset) => preset.id !== id));
}
