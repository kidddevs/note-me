export const SAVED_BRAND_PALETTES_KEY = "book-studio:brand-palettes:v1";
export const MAX_BRAND_PALETTES = 24;
export const MAX_BRAND_PALETTE_COLORS = 16;
export const MAX_BRAND_PALETTE_NAME = 48;

export interface CoverBrandPalette {
  id: string;
  name: string;
  colors: string[];
  createdAt: string;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = "", maximum = 240) {
  return typeof value === "string" ? value.slice(0, maximum) : fallback;
}

function timestamp(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

function normalizeColors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((entry): entry is string => typeof entry === "string" && /^#[0-9a-f]{6}$/i.test(entry))
    .map((entry) => entry.toLocaleLowerCase()))].slice(0, MAX_BRAND_PALETTE_COLORS);
}

function newPaletteId() {
  return `brand-palette-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBrandPalette(name: string, colors: string[], now = new Date()): CoverBrandPalette | null {
  const normalized = normalizeColors(colors);
  if (normalized.length === 0) return null;
  const stamp = now.toISOString();
  return {
    id: newPaletteId(),
    name: text(name, "", MAX_BRAND_PALETTE_NAME).trim() || "Brand palette",
    colors: normalized,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function parsePaletteEntry(value: unknown, stamp: string): CoverBrandPalette | null {
  if (!isRecord(value)) return null;
  const colors = normalizeColors(value.colors);
  if (colors.length === 0) return null;
  const name = text(value.name, "", MAX_BRAND_PALETTE_NAME).trim();
  if (!name) return null;
  return {
    id: text(value.id, "", 120).trim() || newPaletteId(),
    name,
    colors,
    createdAt: timestamp(value.createdAt, stamp),
    updatedAt: timestamp(value.updatedAt, stamp),
  };
}

export function parseBrandPalettes(value: unknown, now = new Date()): CoverBrandPalette[] {
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
  const palettes: CoverBrandPalette[] = [];
  for (const entry of parsed) {
    const palette = parsePaletteEntry(entry, stamp);
    if (!palette) continue;
    if (seen.has(palette.id)) palette.id = newPaletteId();
    seen.add(palette.id);
    palettes.push(palette);
    if (palettes.length >= MAX_BRAND_PALETTES) break;
  }
  return palettes;
}

export function serializeBrandPalettes(palettes: CoverBrandPalette[]) {
  return JSON.stringify(palettes.slice(0, MAX_BRAND_PALETTES));
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface BrandPaletteWriteResult {
  ok: boolean;
  palettes: CoverBrandPalette[];
  message?: string;
}

export function readBrandPalettes(): CoverBrandPalette[] {
  const store = storage();
  if (!store) return [];
  try {
    return parseBrandPalettes(store.getItem(SAVED_BRAND_PALETTES_KEY));
  } catch {
    return [];
  }
}

export function writeBrandPalettes(palettes: CoverBrandPalette[]): BrandPaletteWriteResult {
  const store = storage();
  const sifted = palettes.slice(0, MAX_BRAND_PALETTES);
  if (!store) return { ok: false, palettes: sifted, message: "Brand palette storage is unavailable in this environment." };
  try {
    store.setItem(SAVED_BRAND_PALETTES_KEY, serializeBrandPalettes(sifted));
    return { ok: true, palettes: sifted };
  } catch {
    return { ok: false, palettes: sifted, message: "Brand palettes couldn't be saved because local storage is full." };
  }
}

export function saveBrandPalette(name: string, colors: string[], palettes = readBrandPalettes(), now = new Date()): BrandPaletteWriteResult {
  const palette = createBrandPalette(name, colors, now);
  if (!palette) return { ok: false, palettes, message: "Add at least one colour before saving a brand palette." };
  return writeBrandPalettes([palette, ...palettes]);
}

export function renameBrandPalette(id: string, name: string, palettes = readBrandPalettes(), now = new Date()): BrandPaletteWriteResult {
  const trimmed = text(name, "", MAX_BRAND_PALETTE_NAME).trim();
  if (!trimmed) return { ok: true, palettes };
  return writeBrandPalettes(palettes.map((palette) => palette.id === id ? { ...palette, name: trimmed, updatedAt: now.toISOString() } : palette));
}

export function deleteBrandPalette(id: string, palettes = readBrandPalettes()): BrandPaletteWriteResult {
  return writeBrandPalettes(palettes.filter((palette) => palette.id !== id));
}
