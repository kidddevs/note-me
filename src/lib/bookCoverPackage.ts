import { zipSync } from "fflate";
import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import { COVER_PAPER_STOCKS, coverExportFilename, coverMetrics, renderCoverCanvas, saveCoverBlob, spineWidthMillimetres } from "./bookCoverDoc";
import { buildCoverPdfFile } from "./bookCoverPdf";
import { coverMockupFilename, renderCoverMockup } from "./bookCoverMockup";

export interface CoverPackageOptions {
  dpi?: number;
  pdfx?: boolean;
  mockup?: boolean;
}

export interface CoverPackageFile {
  name: string;
  bytes: Uint8Array;
}

export function coverSpecsText(book: Book, cover: BookCoverDesign, options: Pick<CoverPackageOptions, "pdfx"> = {}) {
  const metrics = coverMetrics(book.trim_size, cover);
  const stock = COVER_PAPER_STOCKS.find((item) => item.id === cover.paperStock)?.label ?? "Book paper";
  return [
    book.title || "Untitled",
    book.author || "Unknown author",
    "",
    "PRINT SPECIFICATION",
    `Trim size          ${metrics.trimWidth} x ${metrics.trimHeight} in`,
    `Spine width        ${metrics.spineWidth} in (${spineWidthMillimetres(metrics.spineWidth)} mm)`,
    `Page count         ${cover.pageCount.toLocaleString()} pages`,
    `Paper stock        ${stock}`,
    `Bleed              ${cover.bleed} in`,
    `Full wrap          ${metrics.fullWidth} x ${metrics.fullHeight} in`,
    `ISBN               ${cover.isbn || "Not supplied"}`,
    `Publisher          ${cover.publisher || "Not supplied"}`,
    "",
    "COLOUR & PDF",
    options.pdfx ? "PDF/X-4           sRGB output intent, flattened image, trim/bleed boxes" : "Standard PDF      sRGB JPEG, trim/bleed geometry",
    "",
    "FILES",
    "  cover/*-full-wrap-print.pdf   Full wrap with crop marks, fold marks, colour bar and slug",
    "  cover/*-front.png            Front cover at trim size",
    "  cover/*-back.png             Back cover at trim size",
    "  cover/*-spine.png            Spine at trim size",
    "  cover/*-mockup-*.png         Presentation mockup",
    "",
    "NOTES",
    "  Open the PDF in a print-shop preflight tool before production.",
    "  The wrap already includes bleed. Crop marks sit outside the trim box.",
    `  Generated ${new Date().toISOString().slice(0, 10)} by NoteMe Cover Studio.`,
  ].join("\n");
}

export function buildCoverPackageZip(files: CoverPackageFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[`cover/${file.name}`] = file.bytes;
  return zipSync(entries, { level: 6 });
}

async function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("A cover image could not be generated.");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function createCoverPackage(book: Book, cover: BookCoverDesign, options: CoverPackageOptions = {}) {
  const dpi = Math.min(450, Math.max(72, Math.round(options.dpi ?? 300)));
  const panels = await Promise.all((["front", "back", "spine"] as const).map(async (target) => {
    const canvas = await renderCoverCanvas(book, cover, target, { dpi });
    return { target, bytes: await canvasPng(canvas) };
  }));
  const pdf = await buildCoverPdfFile(book, cover, { dpi, marks: true, pdfx: options.pdfx });
  const files: CoverPackageFile[] = panels.map((panel) => ({
    name: coverExportFilename(book, panel.target, "png"),
    bytes: panel.bytes,
  }));
  files.push({ name: pdf.filename, bytes: pdf.bytes });
  if (options.mockup !== false) {
    const canvas = await renderCoverMockup(book, cover, { width: 1600, height: 1600, background: "studio" });
    files.push({ name: coverMockupFilename(book, { width: 1600, height: 1600, background: "studio" }), bytes: await canvasPng(canvas) });
  }
  files.push({ name: coverExportFilename(book, "wrap", "txt").replace(/-full-wrap\.txt$/, "-specs.txt"), bytes: new TextEncoder().encode(coverSpecsText(book, cover, options)) });
  const filename = coverExportFilename(book, "wrap", "zip").replace(/-full-wrap\.zip$/, "-production-package.zip");
  return { filename, bytes: buildCoverPackageZip(files), files: files.map((file) => file.name) };
}

export async function downloadCoverPackage(book: Book, cover: BookCoverDesign, options: CoverPackageOptions = {}) {
  const pkg = await createCoverPackage(book, cover, options);
  return saveCoverBlob(new Blob([pkg.bytes], { type: "application/zip" }), pkg.filename);
}
