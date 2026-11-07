import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import {
  COVER_MIN_SPINE,
  barcodeLayer,
  coverLayerVisible,
  coverMetrics,
  isbn13CheckDigit,
  isbnDigits,
  isbnIsValid,
  newCoverLayerId,
  normalizeIsbn13,
  type CoverLayer,
} from "./bookCoverDoc";

export type CoverPreflightSeverity = "error" | "warning" | "info" | "pass";

export type CoverPreflightFixKind =
  | "enable-cover"
  | "correct-isbn"
  | "add-barcode"
  | "place-barcode"
  | "size-barcode"
  | "dedupe-barcodes"
  | "spine-type"
  | "safe-zone"
  | "image-resolution";

export interface CoverPreflightFix {
  kind: CoverPreflightFixKind;
  label: string;
}

export interface CoverPreflightCheck {
  id: string;
  label: string;
  detail: string;
  severity: CoverPreflightSeverity;
  layerId?: string;
  fix?: CoverPreflightFix;
}

export interface CoverPreflightFixResult {
  patch: Partial<BookCoverDesign>;
  message: string;
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
    fix: cover.enabled ? undefined : { kind: "enable-cover", label: "Enable cover" },
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
      add({ id: "isbn-check", label: "ISBN check digit", detail: `The supplied check digit will be corrected to ${isbn13CheckDigit(digits.slice(0, 12))}. Verify the ISBN before print.`, severity: "warning", fix: { kind: "correct-isbn", label: "Apply check digit" } });
    } else {
      add({ id: "isbn", label: "ISBN", detail: "ISBN check digit is valid and the EAN-13 barcode can be generated.", severity: "pass" });
    }
  }

  const barcodes = layers.filter((layer) => layer.type === "barcode" && coverLayerVisible(doc, layer));
  if (barcodes.length === 0) {
    add({ id: "barcode", label: "ISBN barcode", detail: "No visible barcode layer. Add one and place it on the back cover.", severity: "error", fix: { kind: "add-barcode", label: "Add barcode" } });
  } else {
    const backBarcode = barcodes.find((layer) => layer.panel === "back" || layer.panel === "wrap");
    add({
      id: "barcode-placement",
      label: "Barcode placement",
      detail: backBarcode ? "A barcode is present on the back cover." : "The barcode is not on the back cover. Commerce buyers expect it there.",
      severity: backBarcode ? "pass" : "warning",
      layerId: (backBarcode ?? barcodes[0]).id,
      fix: backBarcode ? undefined : { kind: "place-barcode", label: "Move to back" },
    });
    const small = barcodes.filter((layer) => layer.type === "barcode" && (layer.width < 1.7 || layer.height < 0.95));
    add({
      id: "barcode-size",
      label: "Barcode size",
      detail: small.length ? `${small.length} barcode${small.length === 1 ? " is" : "s are"} smaller than the 1.7 × 0.95 in retail minimum.` : "Barcode size is within the usual retail minimum.",
      severity: small.length ? "warning" : "pass",
      layerId: small[0]?.id,
      fix: small.length ? { kind: "size-barcode", label: "Make retail size" } : undefined,
    });
    if (barcodes.length > 1) {
      add({ id: "barcode-duplicate", label: "Duplicate barcodes", detail: `${barcodes.length} visible barcode layers are on the wrap. Keep one commerce block.`, severity: "warning", layerId: barcodes[1].id, fix: { kind: "dedupe-barcodes", label: "Keep one barcode" } });
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
      fix: tiny.length ? { kind: "spine-type", label: "Raise to 6.5 pt" } : undefined,
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
    fix: outside.length || tooClose.length ? { kind: "safe-zone", label: "Move inside safe zone" } : undefined,
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
        : doc.backgroundImage?.src ? "A full-wrap background image is included in the design." : "No photographic image layers on this cover.",
    severity: missingImages.length ? "error" : images.length || doc.backgroundImage?.src ? "pass" : "info",
    layerId: missingImages[0]?.id,
  });

  const measuredImages = images
    .filter((layer) => layer.sourceWidth > 0 && layer.sourceHeight > 0 && layer.width > 0 && layer.height > 0)
    .map((layer) => ({ layer, dpi: Math.floor(Math.min(layer.sourceWidth / layer.width, layer.sourceHeight / layer.height)) }))
    .sort((a, b) => a.dpi - b.dpi);
  const lowResolution = measuredImages.filter((entry) => entry.dpi < 150);
  const reviewResolution = measuredImages.filter((entry) => entry.dpi >= 150 && entry.dpi < 220);
  add({
    id: "image-resolution",
    label: "Image resolution",
    detail: lowResolution.length
      ? `${lowResolution.length} image layer${lowResolution.length === 1 ? " is" : "s are"} below 150 DPI (lowest ${lowResolution[0].dpi} DPI).`
      : reviewResolution.length
        ? `${reviewResolution.length} image layer${reviewResolution.length === 1 ? " is" : "s are"} between 150 and 219 DPI (lowest ${reviewResolution[0].dpi} DPI).`
        : measuredImages.length
          ? `Measured images are at least ${measuredImages[0].dpi} DPI at their placed size.`
          : images.length
            ? "Image resolution couldn't be measured for legacy image layers. Replace the image to record its pixel size."
            : "No photographic images to check.",
    severity: lowResolution.length ? "warning" : measuredImages.length && !reviewResolution.length ? "pass" : "info",
    layerId: lowResolution[0]?.layer.id ?? reviewResolution[0]?.layer.id,
    fix: lowResolution.length ? { kind: "image-resolution", label: "Fit to 300 DPI" } : undefined,
  });

  const background = doc.backgroundImage;
  if (background && background.opacity > 0) {
    const ratios = [background.sourceWidth / metrics.fullWidth, background.sourceHeight / metrics.fullHeight];
    const dpi = Math.floor(background.fit === "contain" ? Math.max(...ratios) : Math.min(...ratios));
    const measured = background.sourceWidth > 0 && background.sourceHeight > 0;
    add({
      id: "background-resolution",
      label: "Background image resolution",
      detail: measured
        ? `The full-wrap background is ${dpi} DPI at its placed size.${dpi < 220 ? " Choose a larger image for sharper print output." : ""}`
        : "Background resolution is unknown. Replace the image to record its pixel dimensions.",
      severity: !measured ? "info" : dpi < 150 ? "warning" : dpi < 220 ? "info" : "pass",
    });
  }

  return checks;
}

function barcodePlacement(metrics: ReturnType<typeof coverMetrics>) {
  const width = Math.min(2, Math.max(1, metrics.trimWidth - 0.5));
  const height = Math.min(1.2, Math.max(0.8, metrics.trimHeight - 0.5));
  return {
    width: Math.round(width * 1000) / 1000,
    height: Math.round(height * 1000) / 1000,
    x: Math.round((metrics.trimWidth - width - 0.25) * 1000) / 1000,
    y: Math.round((metrics.trimHeight - height - 0.25) * 1000) / 1000,
  };
}

function withLayerPatch(cover: BookCoverDesign, layerId: string, patch: Partial<CoverLayer>): Partial<BookCoverDesign> | null {
  if (!cover.doc.layers.some((layer) => layer.id === layerId)) return null;
  return {
    doc: {
      ...cover.doc,
      templateId: cover.doc.templateId || "custom",
      layers: cover.doc.layers.map((layer) => layer.id === layerId ? ({ ...layer, ...patch } as CoverLayer) : layer),
    },
  };
}

export function coverPreflightFix(book: Book, cover: BookCoverDesign, check: CoverPreflightCheck): CoverPreflightFixResult | null {
  const kind = check.fix?.kind;
  if (!kind) return null;
  const metrics = coverMetrics(book.trim_size, cover);
  const layers = cover.doc.layers;
  const barcodes = layers.filter((layer) => layer.type === "barcode" && coverLayerVisible(cover.doc, layer));

  if (kind === "enable-cover") {
    return { patch: { enabled: true }, message: "Cover enabled for print and digital exports." };
  }
  if (kind === "correct-isbn") {
    const normalized = normalizeIsbn13(cover.isbn);
    return normalized ? { patch: { isbn: normalized }, message: `ISBN check digit updated to ${normalized}.` } : null;
  }
  if (kind === "add-barcode") {
    const placement = barcodePlacement(metrics);
    const layer = barcodeLayer({
      id: newCoverLayerId("barcode"),
      name: "ISBN barcode",
      panel: "back",
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    return {
      patch: { doc: { ...cover.doc, templateId: cover.doc.templateId || "custom", layers: [...layers, layer] } },
      message: "Barcode added to the back cover safe corner.",
    };
  }
  if (kind === "place-barcode") {
    const layer = layers.find((item) => item.id === check.layerId) ?? barcodes[0];
    if (!layer || layer.type !== "barcode") return null;
    const placement = barcodePlacement(metrics);
    const width = Math.max(placement.width, layer.width);
    const height = Math.max(placement.height, layer.height);
    const patch = {
      panel: "back" as const,
      width: Math.round(width * 1000) / 1000,
      height: Math.round(height * 1000) / 1000,
      x: Math.round(Math.max(0.25, metrics.trimWidth - width - 0.25) * 1000) / 1000,
      y: Math.round(Math.max(0.25, metrics.trimHeight - height - 0.25) * 1000) / 1000,
    };
    const next = withLayerPatch(cover, layer.id, patch);
    return next ? { patch: next, message: "Barcode moved to the back cover safe corner." } : null;
  }
  if (kind === "size-barcode") {
    const layer = layers.find((item) => item.id === check.layerId) ?? barcodes[0];
    if (!layer || layer.type !== "barcode") return null;
    const placement = barcodePlacement(metrics);
    const width = Math.max(1.7, layer.width, placement.width);
    const height = Math.max(0.95, layer.height, placement.height);
    const nextPanel = layer.panel === "front" || layer.panel === "spine" ? "back" : layer.panel;
    const panelWidth = nextPanel === "wrap" ? metrics.fullWidth : metrics.trimWidth;
    const panelHeight = nextPanel === "wrap" ? metrics.fullHeight : metrics.trimHeight;
    const patch = {
      panel: nextPanel,
      width: Math.round(width * 1000) / 1000,
      height: Math.round(height * 1000) / 1000,
      x: Math.round(Math.max(0.08, Math.min(layer.x, panelWidth - width - 0.08)) * 1000) / 1000,
      y: Math.round(Math.max(0.08, Math.min(layer.y, panelHeight - height - 0.08)) * 1000) / 1000,
    };
    const next = withLayerPatch(cover, layer.id, patch);
    return next ? { patch: next, message: "Barcode enlarged to retail size." } : null;
  }
  if (kind === "dedupe-barcodes") {
    if (barcodes.length <= 1) return null;
    const keep = barcodes.find((layer) => layer.panel === "back" || layer.panel === "wrap") ?? barcodes[0];
    return {
      patch: {
        doc: {
          ...cover.doc,
          layers: layers.map((layer) => layer.type === "barcode" && layer.id !== keep.id && coverLayerVisible(cover.doc, layer) ? { ...layer, visible: false } : layer),
        },
      },
      message: `Kept “${keep.name}” and hid the extra barcode layers.`,
    };
  }
  if (kind === "spine-type") {
    const layer = layers.find((item) => item.id === check.layerId);
    if (!layer || layer.type !== "text") return null;
    const next = withLayerPatch(cover, layer.id, { fontSize: Math.max(6.5, layer.fontSize) });
    return next ? { patch: next, message: "Spine type raised to a printable size." } : null;
  }
  if (kind === "image-resolution") {
    const layer = layers.find((item) => item.id === check.layerId);
    if (!layer || layer.type !== "image" || layer.sourceWidth <= 0 || layer.sourceHeight <= 0) return null;
    const scale = Math.min(1, (layer.sourceWidth / 300) / layer.width, (layer.sourceHeight / 300) / layer.height);
    if (scale >= 0.999) return null;
    const width = Math.round(layer.width * scale * 1000) / 1000;
    const height = Math.round(layer.height * scale * 1000) / 1000;
    if (width < 0.1 || height < 0.1) return null;
    const x = Math.round((layer.x + (layer.width - width) / 2) * 1000) / 1000;
    const y = Math.round((layer.y + (layer.height - height) / 2) * 1000) / 1000;
    const next = withLayerPatch(cover, layer.id, { x, y, width, height });
    return next ? { patch: next, message: `“${layer.name}” resized to roughly 300 DPI.` } : null;
  }
  if (kind === "safe-zone") {
    const layer = layers.find((item) => item.id === check.layerId);
    if (!layer) return null;
    const panelWidth = layer.panel === "wrap" ? metrics.fullWidth : layer.panel === "spine" ? metrics.spineWidth : layer.panel === "back" ? metrics.panelWidths.back : metrics.panelWidths.front;
    const panelHeight = layer.panel === "wrap" ? metrics.fullHeight : metrics.trimHeight;
    const safe = layer.panel === "spine" ? Math.min(0.06, panelWidth * 0.15) : 0.25;
    const bounds = rotatedBounds(layer);
    if (bounds.width > panelWidth - safe * 2 || bounds.height > panelHeight - safe * 2) return null;
    let dx = 0;
    let dy = 0;
    if (bounds.x < safe) dx = safe - bounds.x;
    else if (bounds.x + bounds.width > panelWidth - safe) dx = panelWidth - safe - (bounds.x + bounds.width);
    if (bounds.y < safe) dy = safe - bounds.y;
    else if (bounds.y + bounds.height > panelHeight - safe) dy = panelHeight - safe - (bounds.y + bounds.height);
    if (dx === 0 && dy === 0) return null;
    const x = Math.round((layer.x + dx) * 1000) / 1000;
    const y = Math.round((layer.y + dy) * 1000) / 1000;
    const next = withLayerPatch(cover, layer.id, { x, y });
    return next ? { patch: next, message: `“${layer.name}” moved inside the trim-safe zone.` } : null;
  }
  return null;
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
