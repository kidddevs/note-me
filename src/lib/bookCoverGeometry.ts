import { coverPanelRect, type CoverGuideline, type CoverLayer, type CoverMetrics, type CoverPanel } from "./bookCoverDoc";

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
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function coverSelectionBounds(metrics: CoverMetrics, layers: CoverLayer[]): CoverRect | null {
  return coverRectUnion(layers.map((layer) => coverSpreadRect(metrics, layer)));
}

/**
 * Aligns layers inside a shared bounds rectangle. When bounds is omitted the
 * union of the layers is used, matching Photoshop's align-to-selection feel.
 */
export function alignCoverLayers(metrics: CoverMetrics, layers: CoverLayer[], mode: CoverAlignMode, bounds?: CoverRect | null): CoverPositionPatch[] {
  const target = bounds ?? coverSelectionBounds(metrics, layers);
  if (!target || layers.length === 0) return [];
  return layers.map((layer) => {
    const rect = coverSpreadRect(metrics, layer);
    let spreadX = rect.x;
    let spreadY = rect.y;
    if (mode === "left") spreadX = target.x;
    if (mode === "center-x") spreadX = target.x + (target.width - rect.width) / 2;
    if (mode === "right") spreadX = target.x + target.width - rect.width;
    if (mode === "top") spreadY = target.y;
    if (mode === "middle") spreadY = target.y + (target.height - rect.height) / 2;
    if (mode === "bottom") spreadY = target.y + target.height - rect.height;
    return {
      id: layer.id,
      x: round(layer.x + spreadX - rect.x),
      y: round(layer.y + spreadY - rect.y),
    };
  });
}

/**
 * Distributes layers with equal gaps between their edges. The outermost layers
 * stay put and the inner layers move to create even spacing.
 */
export function distributeCoverLayers(metrics: CoverMetrics, layers: CoverLayer[], axis: CoverDistributeAxis): CoverPositionPatch[] {
  if (layers.length < 3) return [];
  const entries = layers
    .map((layer) => ({ layer, rect: coverSpreadRect(metrics, layer) }))
    .sort((a, b) => axis === "horizontal" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y);
  const first = entries[0];
  const last = entries[entries.length - 1];
  const span = axis === "horizontal"
    ? last.rect.x + last.rect.width - first.rect.x
    : last.rect.y + last.rect.height - first.rect.y;
  const occupied = entries.reduce((total, entry) => total + (axis === "horizontal" ? entry.rect.width : entry.rect.height), 0);
  const gap = (span - occupied) / (entries.length - 1);
  let cursor = axis === "horizontal" ? first.rect.x : first.rect.y;
  return entries.map((entry, index) => {
    const size = axis === "horizontal" ? entry.rect.width : entry.rect.height;
    const spreadPosition = index === 0 ? cursor : index === entries.length - 1
      ? (axis === "horizontal" ? last.rect.x : last.rect.y)
      : cursor;
    cursor += size + gap;
    return {
      id: entry.layer.id,
      x: round(axis === "horizontal" ? entry.layer.x + spreadPosition - entry.rect.x : entry.layer.x),
      y: round(axis === "vertical" ? entry.layer.y + spreadPosition - entry.rect.y : entry.layer.y),
    };
  });
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
