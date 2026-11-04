import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import { COVER_MIN_SPINE, coverLayerVisible, coverMetrics, isbn13CheckDigit, isbnDigits, isbnIsValid } from "./bookCoverDoc";

export type CoverPreflightSeverity = "error" | "warning" | "info" | "pass";

export interface CoverPreflightCheck {
  id: string;
  label: string;
  detail: string;
  severity: CoverPreflightSeverity;
  layerId?: string;
}

export interface CoverPreflightSummary {
  errors: number;
  warnings: number;
  infos: number;
  passes: number;
  total: number;
}

function numberOrZero(value: string | undefined) {
  return Number(value ?? 0);
}

function rotatedBounds(layer: { x: number; y: number; width: number; height: number; rotation: number }) {
  const radians = (layer.rotation * Math.PI) / 180;
  const width = Math.abs(layer.width * Math.cos(radians)) + Math.abs(layer.height * Math.sin(radians));
  const height = Math.abs(layer.width * Math.sin(radians)) + Math.abs(layer.height * Math.cos(radians));
  const centerX = layer.x + layer.width / 2;
  const centerY = layer.y + layer.height / 2;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

export function coverPreflight(book: Book, cover: BookCoverDesign): CoverPreflightCheck[] {
  const metrics = coverMetrics(book.trim_size, cover);
  const doc = cover.doc;
  const layers = doc.layers;
  const checks: CoverPreflightCheck[] = [];
  const add = (check: CoverPreflightCheck) => checks.push(check);
  const frontLayers = layers.filter((layer) => layer.panel === "front" || layer.panel === "wrap");
  const spineLayers = layers.filter((layer) => layer.panel === "spine");
  const titleLayer = frontLayers.find((layer) => layer.type === "text" && (layer.text.includes("{{title}}") || /title/i.test(layer.name)));
  const authorLayer = frontLayers.find((layer) => layer.type === "text" && (layer.text.includes("{{author}}") || /author/i.test(layer.name)));

  add({
    id: "layers",
    label: "Cover artwork",
    detail: layers.length > 0 ? `${layers.length} layer${layers.length === 1 ? "" : "s"} on the wrap.` : "The cover has no layers yet.",
    severity: layers.length > 0 ? "pass" : "error",
  });
  add({
    id: "enabled",
    label: "Cover inclusion",
    detail: cover.enabled ? "The cover is enabled for print and digital exports." : "The cover is disabled and will be skipped by print and export.",
    severity: cover.enabled ? "pass" : "warning",
  });
  add({
    id: "title",
    label: "Front title",
    detail: titleLayer ? `Using “${titleLayer.name}”.` : "No front-cover title layer was found. Add a text layer with {{title}}.",
    severity: !titleLayer ? "warning" : coverLayerVisible(doc, titleLayer) ? "pass" : "warning",
    layerId: titleLayer?.id,
  });
  add({
    id: "author",
    label: "Author credit",
    detail: authorLayer ? `Using “${authorLayer.name}”.` : "No front-cover author layer was found. Add a text layer with {{author}}.",
    severity: authorLayer ? "pass" : "warning",
    layerId: authorLayer?.id,
  });

  if (!cover.isbn.trim()) {
    add({ id: "isbn", label: "ISBN", detail: "Add an ISBN before sending the cover to print.", severity: "error" });
  } else if (!isbnIsValid(cover.isbn)) {
    add({ id: "isbn", label: "ISBN", detail: "The ISBN check digit is invalid. Recheck the 13-digit number.", severity: "error" });
  } else {
    const digits = isbnDigits(cover.isbn);
    if (digits.length === 13 && numberOrZero(digits[12]) !== isbn13CheckDigit(digits.slice(0, 12))) {
      add({ id: "isbn-check", label: "ISBN check digit", detail: `The supplied check digit will be corrected to ${isbn13CheckDigit(digits.slice(0, 12))}. Verify the ISBN before print.`, severity: "warning" });
    } else {
      add({ id: "isbn", label: "ISBN", detail: "ISBN check digit is valid and the EAN-13 barcode can be generated.", severity: "pass" });
    }
  }

  const barcodes = layers.filter((layer) => layer.type === "barcode" && coverLayerVisible(doc, layer));
  if (barcodes.length === 0) {
    add({ id: "barcode", label: "ISBN barcode", detail: "No visible barcode layer. Add one and place it on the back cover.", severity: "error" });
  } else {
    const backBarcode = barcodes.find((layer) => layer.panel === "back" || layer.panel === "wrap");
    add({
      id: "barcode-placement",
      label: "Barcode placement",
      detail: backBarcode ? "A barcode is present on the back cover." : "The barcode is not on the back cover. Commerce buyers expect it there.",
      severity: backBarcode ? "pass" : "warning",
      layerId: (backBarcode ?? barcodes[0]).id,
    });
    const small = barcodes.filter((layer) => layer.type === "barcode" && (layer.width < 1.7 || layer.height < 0.95));
    add({
      id: "barcode-size",
      label: "Barcode size",
      detail: small.length ? `${small.length} barcode${small.length === 1 ? " is" : "s are"} smaller than the 1.7 × 0.95 in retail minimum.` : "Barcode size is within the usual retail minimum.",
      severity: small.length ? "warning" : "pass",
      layerId: small[0]?.id,
    });
    if (barcodes.length > 1) {
      add({ id: "barcode-duplicate", label: "Duplicate barcodes", detail: `${barcodes.length} visible barcode layers are on the wrap. Keep one commerce block.`, severity: "warning", layerId: barcodes[1].id });
    }
  }

  add({
    id: "spine",
    label: "Spine width",
    detail: `${metrics.spineWidth} in (${Math.round(metrics.spineWidth * 25.4 * 10) / 10} mm) from ${cover.pageCount.toLocaleString()} pages.`,
    severity: metrics.spineWidth >= COVER_MIN_SPINE && cover.pageCount > 0 ? "pass" : "error",
  });
  if (cover.pageCount < 24) {
    add({ id: "page-count", label: "Page count", detail: `${cover.pageCount.toLocaleString()} pages is unusually low for a printed book. Verify final pagination.`, severity: "warning" });
  }
  const spineText = spineLayers.filter((layer) => layer.type === "text" && coverLayerVisible(doc, layer));
  if (spineText.length > 0) {
    const tiny = spineText.filter((layer) => layer.type === "text" && layer.fontSize < 6);
    add({
      id: "spine-type",
      label: "Spine typography",
      detail: tiny.length ? "Spine text below 6 pt can become unreadable after trimming." : "Spine text is at least 6 pt.",
      severity: tiny.length ? "warning" : "pass",
      layerId: tiny[0]?.id,
    });
  } else {
    add({ id: "spine-type", label: "Spine typography", detail: "No spine text layers. This is valid for a minimal spine.", severity: "info" });
  }

  add({
    id: "bleed",
    label: "Bleed",
    detail: cover.bleed >= 0.125 ? `${cover.bleed} in bleed on every side.` : `${cover.bleed} in bleed is below the usual 0.125 in print requirement.`,
    severity: cover.bleed >= 0.125 ? "pass" : "warning",
  });

  const outside: typeof layers = [];
  const tooClose: typeof layers = [];
  for (const layer of layers) {
    if (!coverLayerVisible(doc, layer) || (layer.type !== "text" && layer.type !== "barcode")) continue;
    const panelWidth = layer.panel === "wrap" ? metrics.fullWidth : layer.panel === "spine" ? metrics.spineWidth : layer.panel === "back" ? metrics.panelWidths.back : metrics.panelWidths.front;
    const panelHeight = layer.panel === "wrap" ? metrics.fullHeight : metrics.trimHeight;
    const bounds = rotatedBounds(layer);
    const overflow = Math.max(0, -bounds.x, -bounds.y, bounds.x + bounds.width - panelWidth, bounds.y + bounds.height - panelHeight);
    if (overflow > 0.05) {
      outside.push(layer);
      continue;
    }
    const safe = layer.panel === "spine" ? Math.min(0.06, panelWidth * 0.15) : 0.25;
    if (overflow > 0 || bounds.x < safe || bounds.y < safe || bounds.x + bounds.width > panelWidth - safe || bounds.y + bounds.height > panelHeight - safe) tooClose.push(layer);
  }
  add({
    id: "safe-zone",
    label: "Safe zone",
    detail: outside.length
      ? `${outside.length} live layer${outside.length === 1 ? " extends" : "s extend"} beyond its panel and may be trimmed.`
      : tooClose.length
        ? `${tooClose.length} live layer${tooClose.length === 1 ? " sits" : "s sit"} inside the 0.25 in trim-safe margin.`
        : "All live text and barcode layers sit inside the trim-safe zone.",
    severity: outside.length ? "error" : tooClose.length ? "warning" : "pass",
    layerId: (outside[0] ?? tooClose[0])?.id,
  });

  const images = layers.filter((layer) => layer.type === "image");
  const missingImages = images.filter((layer) => !layer.src);
  add({
    id: "images",
    label: "Image assets",
    detail: missingImages.length
      ? `${missingImages.length} image layer${missingImages.length === 1 ? " has" : "s have"} no source.`
      : images.length
        ? `${images.length} image layer${images.length === 1 ? " is" : "s are"} embedded in the design.`
        : "No photographic image layers on this cover.",
    severity: missingImages.length ? "error" : images.length ? "pass" : "info",
    layerId: missingImages[0]?.id,
  });

  return checks;
}

export function coverPreflightSummary(checks: CoverPreflightCheck[]): CoverPreflightSummary {
  return {
    errors: checks.filter((check) => check.severity === "error").length,
    warnings: checks.filter((check) => check.severity === "warning").length,
    infos: checks.filter((check) => check.severity === "info").length,
    passes: checks.filter((check) => check.severity === "pass").length,
    total: checks.length,
  };
}
