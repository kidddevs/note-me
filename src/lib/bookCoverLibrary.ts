import {
  parseCoverDocument,
  type BookCoverDocument,
  type CoverGuideline,
  type CoverLayer,
  type CoverMetrics,
} from "./bookCoverDoc";

export const SAVED_COVER_TEMPLATES_KEY = "book-studio:cover-templates:v1";
export const MAX_SAVED_COVER_TEMPLATES = 24;
export const MAX_SAVED_COVER_TEMPLATE_NAME = 60;

export interface SavedCoverMetrics {
  trimWidth: number;
  trimHeight: number;
  spineWidth: number;
  bleed: number;
  fullWidth: number;
  fullHeight: number;
}

export interface SavedCoverTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metrics: SavedCoverMetrics;
  doc: BookCoverDocument;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function metricNumber(value: unknown, fallback: number, minimum = 0.01, maximum = 100) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

export function coverMetricsSnapshot(metrics: CoverMetrics): SavedCoverMetrics {
  return {
    trimWidth: metrics.trimWidth,
    trimHeight: metrics.trimHeight,
    spineWidth: metrics.spineWidth,
    bleed: metrics.bleed,
    fullWidth: metrics.fullWidth,
    fullHeight: metrics.fullHeight,
  };
}

function parseSavedMetrics(value: unknown): SavedCoverMetrics | null {
  if (!isRecord(value)) return null;
  const trimWidth = metricNumber(value.trimWidth, 0);
  const trimHeight = metricNumber(value.trimHeight, 0);
  const spineWidth = metricNumber(value.spineWidth, 0);
  const bleed = metricNumber(value.bleed, 0.125, 0, 0.5);
  const fullWidth = metricNumber(value.fullWidth, trimWidth * 2 + spineWidth + bleed * 2);
  const fullHeight = metricNumber(value.fullHeight, trimHeight + bleed * 2);
  if (trimWidth <= 0 || trimHeight <= 0) return null;
  return { trimWidth, trimHeight, spineWidth, bleed, fullWidth, fullHeight };
}

/** Reflows a saved document from its source trim/spine to the active book's metrics. */
export function adaptCoverDocumentToMetrics(doc: BookCoverDocument, from: SavedCoverMetrics, to: SavedCoverMetrics): BookCoverDocument {
  const horizontalFor = (panel: CoverLayer["panel"] | CoverGuideline["panel"]) => {
    if (panel === "wrap") return to.fullWidth / from.fullWidth;
    if (panel === "spine") return from.spineWidth > 0 ? to.spineWidth / from.spineWidth : 1;
    return to.trimWidth / from.trimWidth;
  };
  const verticalFor = (panel: CoverLayer["panel"] | CoverGuideline["panel"]) => panel === "wrap" ? to.fullHeight / from.fullHeight : to.trimHeight / from.trimHeight;
  const scaleLayer = (layer: CoverLayer): CoverLayer => {
    const sx = horizontalFor(layer.panel);
    const sy = verticalFor(layer.panel);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return layer;
    return {
      ...layer,
      x: round(layer.x * sx),
      y: round(layer.y * sy),
      width: round(layer.width * sx),
      height: round(layer.height * sy),
    };
  };
  const scaleGuide = (guide: CoverGuideline): CoverGuideline => ({
    ...guide,
    position: round(guide.position * (guide.axis === "x" ? horizontalFor(guide.panel) : verticalFor(guide.panel))),
  });
  return {
    ...doc,
    layers: doc.layers.map(scaleLayer),
    guides: doc.guides.map(scaleGuide),
  };
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

function newTemplateId() {
  return `cover-template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Deep-clones a document through the normalizer so saved templates stay safe and portable. */
export function cleanCoverDocument(doc: BookCoverDocument): BookCoverDocument {
  const clone = JSON.parse(JSON.stringify(doc)) as unknown;
  return parseCoverDocument(clone);
}

export function createSavedCoverTemplate(name: string, doc: BookCoverDocument, metrics: CoverMetrics, now = new Date()): SavedCoverTemplate {
  const stamp = now.toISOString();
  const trimmed = text(name, "Untitled template", MAX_SAVED_COVER_TEMPLATE_NAME).trim();
  return {
    id: newTemplateId(),
    name: trimmed || "Untitled template",
    createdAt: stamp,
    updatedAt: stamp,
    metrics: coverMetricsSnapshot(metrics),
    doc: cleanCoverDocument(doc),
  };
}

export function renameSavedCoverTemplate(template: SavedCoverTemplate, name: string, now = new Date()): SavedCoverTemplate {
  const trimmed = text(name, template.name, MAX_SAVED_COVER_TEMPLATE_NAME).trim();
  return {
    ...template,
    name: trimmed || template.name,
    updatedAt: now.toISOString(),
  };
}

export function parseSavedCoverTemplates(value: unknown, now = new Date()): SavedCoverTemplate[] {
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
  const templates: SavedCoverTemplate[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry)) continue;
    const name = text(entry.name, "", MAX_SAVED_COVER_TEMPLATE_NAME).trim();
    if (!name) continue;
    const doc = parseCoverDocument(entry.doc);
    if (doc.layers.length === 0 && !doc.templateId) continue;
    const metrics = parseSavedMetrics(entry.metrics);
    if (!metrics) continue;
    let id = text(entry.id, "", 120).trim();
    if (!id || seen.has(id)) id = newTemplateId();
    seen.add(id);
    templates.push({
      id,
      name,
      createdAt: timestamp(entry.createdAt, stamp),
      updatedAt: timestamp(entry.updatedAt, stamp),
      metrics,
      doc,
    });
    if (templates.length >= MAX_SAVED_COVER_TEMPLATES) break;
  }
  return templates;
}

export function serializeSavedCoverTemplates(templates: SavedCoverTemplate[]) {
  return JSON.stringify(templates.slice(0, MAX_SAVED_COVER_TEMPLATES));
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface CoverTemplateWriteResult {
  ok: boolean;
  templates: SavedCoverTemplate[];
  message?: string;
}

export function readSavedCoverTemplates(): SavedCoverTemplate[] {
  const store = storage();
  if (!store) return [];
  try {
    return parseSavedCoverTemplates(store.getItem(SAVED_COVER_TEMPLATES_KEY));
  } catch {
    return [];
  }
}

export function writeSavedCoverTemplates(templates: SavedCoverTemplate[]): CoverTemplateWriteResult {
  const store = storage();
  const sifted = templates.slice(0, MAX_SAVED_COVER_TEMPLATES);
  if (!store) return { ok: false, templates: sifted, message: "Local template storage is unavailable in this environment." };
  try {
    store.setItem(SAVED_COVER_TEMPLATES_KEY, serializeSavedCoverTemplates(sifted));
    return { ok: true, templates: sifted };
  } catch {
    return {
      ok: false,
      templates: sifted,
      message: "Templates couldn't be saved because local storage is full. Remove a template or replace large photos with smaller files.",
    };
  }
}

export function saveCoverTemplate(name: string, doc: BookCoverDocument, metrics: CoverMetrics, templates = readSavedCoverTemplates()): CoverTemplateWriteResult {
  const template = createSavedCoverTemplate(name, doc, metrics);
  return writeSavedCoverTemplates([template, ...templates]);
}

/** Builds the document at the active metrics so previews and application match. */
export function savedTemplateDocument(template: SavedCoverTemplate, metrics: CoverMetrics): BookCoverDocument {
  return adaptCoverDocumentToMetrics(template.doc, template.metrics, coverMetricsSnapshot(metrics));
}

export function deleteSavedCoverTemplate(id: string, templates = readSavedCoverTemplates()): CoverTemplateWriteResult {
  return writeSavedCoverTemplates(templates.filter((template) => template.id !== id));
}

export function renameCoverTemplate(id: string, name: string, templates = readSavedCoverTemplates()): CoverTemplateWriteResult {
  return writeSavedCoverTemplates(templates.map((template) => template.id === id ? renameSavedCoverTemplate(template, name) : template));
}
