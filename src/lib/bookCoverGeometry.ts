import { coverLayerLocked, coverLayerMinimumHeight, coverPanelRect, type BookCoverDocument, type CoverGuideline, type CoverLayer, type CoverMetrics, type CoverPanel } from "./bookCoverDoc";
import { alignStudioRects, distributeStudioRects, rotatedStudioBounds, studioBounds, type StudioSpacing } from "./studioGeometry";

export interface CoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CoverAlignMode = "left" | "center-x" | "right" | "top" | "middle" | "bottom";
export type CoverDistributeAxis = "horizontal" | "vertical";

export interface CoverPositionPatch {
  id: string;
  x: number;
  y: number;
}

export interface CoverSnapResult {
  x: number;
  y: number;
  vertical: number[];
  horizontal: number[];
}

/** A layer's rectangle in full-wrap inches, regardless of which panel owns it. */
export function coverSpreadRect(metrics: CoverMetrics, layer: CoverLayer): CoverRect {
  if (layer.panel === "wrap") return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  const origin = metrics.panelOrigins[layer.panel];
  return { x: origin.x + layer.x, y: origin.y + layer.y, width: layer.width, height: layer.height };
}

export function coverRectUnion(rects: CoverRect[]): CoverRect | null {
  return studioBounds(rects);
}

export function coverSelectionBounds(metrics: CoverMetrics, layers: CoverLayer[]): CoverRect | null {
  return coverRectUnion(layers.map((layer) => rotatedStudioBounds(coverSpreadRect(metrics, layer), layer.rotation)));
}

/**
 * Aligns layers inside a shared bounds rectangle. When bounds is omitted the
 * union of the layers is used, matching Photoshop's align-to-selection feel.
 */
export function alignCoverLayers(metrics: CoverMetrics, layers: CoverLayer[], mode: CoverAlignMode, bounds?: CoverRect | null): CoverPositionPatch[] {
  const rects = layers.map((layer) => rotatedStudioBounds(coverSpreadRect(metrics, layer), layer.rotation));
  return alignStudioRects(rects, mode, bounds ?? studioBounds(rects)).map((rect, i) => ({
    id: layers[i].id, x: round(layers[i].x + rect.x - rects[i].x), y: round(layers[i].y + rect.y - rects[i].y),
  }));
}

/**
 * Distributes layers with equal gaps between their edges. The outermost layers
 * stay put and the inner layers move to create even spacing.
 */
export function distributeCoverLayers(metrics: CoverMetrics, layers: CoverLayer[], axis: CoverDistributeAxis, spacing: StudioSpacing = "gaps"): CoverPositionPatch[] {
  const rects = layers.map((layer) => rotatedStudioBounds(coverSpreadRect(metrics, layer), layer.rotation));
  return distributeStudioRects(rects, axis, spacing).map((rect, i) => ({
    id: layers[i].id, x: round(layers[i].x + rect.x - rects[i].x), y: round(layers[i].y + rect.y - rects[i].y),
  }));
}

export interface CoverSelectionTransform {
  dx?: number;
  dy?: number;
  scale?: number;
  rotation?: number;
  anchor?: { x: number; y: number };
}

/** An atomic similarity transform, including text and physical effects, across panels. */
export function transformCoverSelection(metrics: CoverMetrics, doc: BookCoverDocument, ids: string[], change: CoverSelectionTransform): Array<{ id: string; patch: Partial<CoverLayer> }> {
  const layers = doc.layers.filter((layer) => ids.includes(layer.id));
  const bounds = coverSelectionBounds(metrics, layers);
  const { dx = 0, dy = 0, scale = 1, rotation = 0 } = change;
  const anchor = change.anchor ?? (bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : { x: 0, y: 0 });
  if (!bounds || new Set(ids).size !== layers.length || layers.some((layer) => coverLayerLocked(doc, layer)) || ![dx, dy, scale, rotation, anchor.x, anchor.y].every(Number.isFinite) || scale <= 0) return [];
  if (!dx && !dy && scale === 1 && !rotation) return [];
  const angle = rotation * Math.PI / 180;
  const updates = layers.map((layer) => {
    const rect = coverSpreadRect(metrics, layer);
    const offsetX = (rect.x + rect.width / 2 - anchor.x) * scale;
    const offsetY = (rect.y + rect.height / 2 - anchor.y) * scale;
    const width = layer.width * scale, height = layer.height * scale;
    const patch: Partial<CoverLayer> = {
      x: round(layer.x + anchor.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle) + dx - width / 2 - rect.x),
      y: round(layer.y + anchor.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle) + dy - height / 2 - rect.y),
      width: round(width), height: round(height), rotation: round(((layer.rotation + rotation + 180) % 360 + 360) % 360 - 180),
    };
    if (scale !== 1) {
      if (layer.shadow.enabled) patch.shadow = { ...layer.shadow, blur: round(layer.shadow.blur * scale), offsetX: round(layer.shadow.offsetX * scale), offsetY: round(layer.shadow.offsetY * scale) };
      if (layer.glow.enabled) patch.glow = { ...layer.glow, blur: round(layer.glow.blur * scale) };
      if (layer.type === "text") {
        Object.assign(patch, { fontSize: round(layer.fontSize * scale) });
        if (layer.highlight.enabled) Object.assign(patch, { highlight: { ...layer.highlight, padding: round(layer.highlight.padding * scale), radius: round(layer.highlight.radius * scale) } });
      }
      if (layer.type === "shape") Object.assign(patch, { radius: round(layer.radius * scale), strokeWidth: round(layer.strokeWidth * scale) });
      if (layer.type === "image") Object.assign(patch, { radius: round(layer.radius * scale), blur: round(layer.blur * scale) });
    }
    return { id: layer.id, patch };
  });
  // Reject the entire operation if reloading would clamp any transformed geometry.
  if (updates.some(({ patch }, index) => ![patch.x!, patch.y!].every((v) => v >= -20 && v <= 60)
    || patch.width! < 0.02 || patch.width! > 60 || patch.height! < coverLayerMinimumHeight(layers[index].type) || patch.height! > 60
    || ("fontSize" in patch && (patch.fontSize! < 4 || patch.fontSize! > 240))
    || (patch.shadow && (patch.shadow.blur > 1 || Math.abs(patch.shadow.offsetX) > 1 || Math.abs(patch.shadow.offsetY) > 1)) || (patch.glow && patch.glow.blur > 1)
    || ("radius" in patch && patch.radius! > 12) || ("strokeWidth" in patch && patch.strokeWidth! > 1) || ("blur" in patch && patch.blur! > 0.08)
    || ("highlight" in patch && (patch.highlight!.padding > 0.3 || patch.highlight!.radius > 0.2)))) return [];
  return updates;
}

/**
 * Finds the nearest alignment target for each axis. Callers pass candidate
 * edges/centres from other layers, custom guides, and panel/or spread edges.
 */
export function snapCoverRect(rect: CoverRect, targetsX: number[], targetsY: number[], threshold = 0.055): CoverSnapResult {
  const best = (targets: number[], anchors: number[]) => {
    let distance = threshold;
    let delta = 0;
    let target: number | null = null;
    for (const candidate of targets) {
      for (const anchor of anchors) {
        const next = candidate - anchor;
        if (Math.abs(next) <= distance) {
          distance = Math.abs(next);
          delta = next;
          target = candidate;
        }
      }
    }
    return { delta, target };
  };
  const xSnap = best(targetsX, [rect.x, rect.x + rect.width / 2, rect.x + rect.width]);
  const ySnap = best(targetsY, [rect.y, rect.y + rect.height / 2, rect.y + rect.height]);
  return {
    x: round(rect.x + xSnap.delta),
    y: round(rect.y + ySnap.delta),
    vertical: xSnap.target === null ? [] : [round(xSnap.target)],
    horizontal: ySnap.target === null ? [] : [round(ySnap.target)],
  };
}

/** Converts full-wrap guide positions into the active panel's local inches. */
export function coverGuideSpreadPosition(metrics: CoverMetrics, guide: CoverGuideline): number {
  if (guide.panel === "wrap") return guide.position;
  const origin = metrics.panelOrigins[guide.panel];
  return (guide.axis === "x" ? origin.x : origin.y) + guide.position;
}

/** Converts a spread-inch position into a guide position for a given panel. */
export function coverGuidePanelPosition(metrics: CoverMetrics, guide: Omit<CoverGuideline, "position">, spreadPosition: number): number {
  if (guide.panel === "wrap") return round(spreadPosition);
  const origin = metrics.panelOrigins[guide.panel];
  return round(spreadPosition - (guide.axis === "x" ? origin.x : origin.y));
}

export function coverGuideVisible(guide: CoverGuideline, panel: CoverPanel): boolean {
  return panel === "wrap" || guide.panel === "wrap" || guide.panel === panel;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function coverPanelSize(metrics: CoverMetrics, panel: CoverPanel) {
  if (panel === "wrap") return { width: metrics.fullWidth, height: metrics.fullHeight };
  return { width: metrics.panelWidths[panel], height: metrics.trimHeight };
}

export function coverLayerPanelSize(metrics: CoverMetrics, layer: CoverLayer) {
  return coverPanelSize(metrics, layer.panel);
}

export function coverPanelRectFor(metrics: CoverMetrics, panel: CoverPanel): CoverRect {
  return panel === "wrap"
    ? { x: 0, y: 0, width: metrics.fullWidth, height: metrics.fullHeight }
    : coverPanelRect(metrics, panel);
}
