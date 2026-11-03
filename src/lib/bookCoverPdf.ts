import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import { coverExportFilename, coverMetrics, renderCoverCanvas, saveCoverBlob } from "./bookCoverDoc";

export const COVER_PDF_SLUG = 0.25;

export interface CoverPdfOptions {
  pageWidth: number;
  pageHeight: number;
  imageWidth: number;
  imageHeight: number;
}

function ascii(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function points(value: number) {
  return Math.round(value * 72 * 100) / 100;
}

/**
 * Wraps a JPEG into a one-page PDF. The JPEG is embedded with DCTDecode, so no
 * additional encoder is needed and the file stays small enough for print shops.
 */
export function buildCoverPdf(jpeg: Uint8Array, options: CoverPdfOptions): Uint8Array {
  const width = points(options.pageWidth);
  const height = points(options.pageHeight);
  const imageWidth = Math.max(1, Math.round(options.imageWidth));
  const imageHeight = Math.max(1, Math.round(options.imageHeight));
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = ascii(content);
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? ascii(part) : part;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const beginObject = (index: number) => {
    offsets[index] = offset;
    push(`${index} 0 obj\n`);
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  beginObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObject(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  beginObject(3);
  push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`);
  beginObject(4);
  push(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  beginObject(5);
  push(`<< /Length ${contentBytes.length} >>\nstream\n`);
  push(contentBytes);
  push("endstream\nendobj\n");

  const xrefStart = offset;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index += 1) push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return concat(chunks);
}

export async function downloadCoverPdf(book: Book, cover: BookCoverDesign, options: { dpi?: number; marks?: boolean } = {}) {
  const marks = options.marks ?? true;
  const slug = marks ? COVER_PDF_SLUG : 0;
  const dpi = Math.min(450, Math.max(72, Math.round(options.dpi ?? 300)));
  const canvas = await renderCoverCanvas(book, cover, "wrap", { dpi, bleed: true, marks, slug });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
  if (!blob) throw new Error("The print cover could not be generated.");
  const metrics = coverMetrics(book.trim_size, cover);
  const pdf = buildCoverPdf(new Uint8Array(await blob.arrayBuffer()), {
    pageWidth: metrics.fullWidth + slug * 2,
    pageHeight: metrics.fullHeight + slug * 2,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
  });
  const filename = coverExportFilename(book, "wrap", "pdf").replace(/\.pdf$/, marks ? "-print.pdf" : ".pdf");
  return saveCoverBlob(new Blob([pdf], { type: "application/pdf" }), filename);
}
