import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import { coverLayerVisible, coverMetrics, imageLayer, layerSpreadRect, renderCoverCanvas, roundInches, type BookCoverDocument, type CoverImageLayer, type CoverLayer, type CoverMetrics, type CoverPanelRect } from "./bookCoverDoc";
import { coverRectUnion } from "./bookCoverGeometry";

/** Export bounds include rotated frames and room for non-destructive effects. */
export function coverSelectionExportBounds(metrics: CoverMetrics, layers: CoverLayer[]): CoverPanelRect | null {
  return coverRectUnion(layers.map((layer) => {
    const rect = layerSpreadRect(metrics, layer);
    const angle = layer.rotation * Math.PI / 180;
    const width = Math.abs(Math.cos(angle)) * rect.width + Math.abs(Math.sin(angle)) * rect.height;
    const height = Math.abs(Math.sin(angle)) * rect.width + Math.abs(Math.cos(angle)) * rect.height;
    const padding = 0.025
      + (layer.shadow.enabled ? Math.max(Math.abs(layer.shadow.offsetX), Math.abs(layer.shadow.offsetY)) + layer.shadow.blur * 3 : 0)
      + (layer.glow.enabled ? layer.glow.blur * 3 : 0)
      + (layer.type === "image" ? layer.blur * 3 : layer.type === "text" && layer.effect !== "none" ? 0.12 : 0);
    return { x: rect.x + (rect.width - width) / 2 - padding, y: rect.y + (rect.height - height) / 2 - padding, width: width + padding * 2, height: height + padding * 2 };
  }));
}

/** Uses the normal renderer while keeping clipping bases in the document. */
export async function renderCoverSelectionCanvas(book: Book, cover: BookCoverDesign, ids: string[], dpi = 300) {
  const selected = cover.doc.layers.filter((layer) => ids.includes(layer.id) && coverLayerVisible(cover.doc, layer));
  const region = coverSelectionExportBounds(coverMetrics(book.trim_size, cover), selected);
  if (!region) throw new Error("Select at least one visible layer to export.");
  const resolution = Number.isFinite(dpi) ? Math.min(450, Math.max(72, dpi)) : 300;
  if (region.width * region.height * resolution * resolution > 32_000_000) throw new Error("This selection is too large at this resolution. Use 150 DPI or reduce its size.");
  return renderCoverCanvas(book, cover, "wrap", { dpi: resolution, region, layerIds: selected.map((layer) => layer.id), transparent: true });
}

/** Lifts a background into the same full-wrap frame without changing its appearance. */
export function liftCoverBackground(doc: BookCoverDocument, metrics: CoverMetrics, id: string) {
  const background = doc.backgroundImage;
  if (!background?.src) return null;
  const layer = imageLayer({
    ...background, id, name: "Background image", panel: "wrap", x: 0, y: 0,
    width: metrics.fullWidth, height: metrics.fullHeight,
  });
  return { layer, doc: { ...doc, templateId: doc.templateId || "custom", backgroundImage: null, layers: [layer, ...doc.layers] } };
}

/** Tone reset deliberately preserves the crop, flips, and painted erase mask. */
export function resetCoverImageTone(layer: CoverImageLayer): CoverImageLayer {
  return { ...layer, brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, grayscale: false, sepia: false, tint: "#ffffff", tintStrength: 0 };
}

export function resetCoverImageCrop(layer: CoverImageLayer): CoverImageLayer {
  return { ...layer, fit: "cover", mask: "none", radius: 0, focusX: 0.5, focusY: 0.5, flipX: false, flipY: false };
}

/** Fits the frame to the original photograph's ratio while keeping its center. */
export function matchCoverImageRatio(layer: CoverImageLayer): Partial<CoverImageLayer> | null {
  if (layer.sourceWidth <= 0 || layer.sourceHeight <= 0) return null;
  const height = roundInches(Math.max(0.05, Math.min(100, layer.width * layer.sourceHeight / layer.sourceWidth)));
  return { height, y: roundInches(layer.y + (layer.height - height) / 2) };
}
