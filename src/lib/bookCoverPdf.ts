import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import { coverExportFilename, coverMetrics, renderCoverCanvas, saveCoverBlob } from "./bookCoverDoc";

export const COVER_PDF_SLUG = 0.25;

export interface CoverPdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverPdfOptions {
  pageWidth: number;
  pageHeight: number;
  imageWidth: number;
  imageHeight: number;
  pdfx?: boolean;
  trimBox?: CoverPdfBox;
  bleedBox?: CoverPdfBox;
  title?: string;
  author?: string;
  creationDate?: Date | string;
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

function pdfString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function xmlString(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pdfDate(value?: Date | string) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  const safe = Number.isFinite(date.getTime()) ? date : new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `D:${safe.getUTCFullYear()}${pad(safe.getUTCMonth() + 1)}${pad(safe.getUTCDate())}${pad(safe.getUTCHours())}${pad(safe.getUTCMinutes())}${pad(safe.getUTCSeconds())}Z`;
}

function pdfBox(box: CoverPdfBox, pageHeight: number) {
  const left = points(box.x);
  const bottom = points(pageHeight - (box.y + box.height));
  const right = points(box.x + box.width);
  const top = points(pageHeight - box.y);
  return `[${left} ${bottom} ${right} ${top}]`;
}

function fileId(jpeg: Uint8Array, options: CoverPdfOptions) {
  let hash = 2166136261;
  const seed = `${jpeg.length}:${options.imageWidth}:${options.imageHeight}:${options.pageWidth}:${options.pageHeight}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const one = (hash >>> 0).toString(16).padStart(8, "0");
  hash = Math.imul(hash ^ 0x9e3779b9, 16777619);
  const two = (hash >>> 0).toString(16).padStart(8, "0");
  return `${one}${two}${one}${two}`;
}

/**
 * Wraps a JPEG into a one-page PDF. The JPEG is embedded with DCTDecode, so no
 * additional encoder is needed and the file stays small enough for print shops.
 * With pdfx enabled it adds the PDF/X-4 version keys, XMP identification, page
 * boxes, and an sRGB output intent for a print-shop handoff.
 */
export function buildCoverPdf(jpeg: Uint8Array, options: CoverPdfOptions): Uint8Array {
  const width = points(options.pageWidth);
  const height = points(options.pageHeight);
  const imageWidth = Math.max(1, Math.round(options.imageWidth));
  const imageHeight = Math.max(1, Math.round(options.imageHeight));
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = ascii(content);
  const pdfx = Boolean(options.pdfx);
  const objectCount = pdfx ? 8 : 5;
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
  const boxes = pdfx && options.trimBox && options.bleedBox
    ? ` /BleedBox ${pdfBox(options.bleedBox, options.pageHeight)} /TrimBox ${pdfBox(options.trimBox, options.pageHeight)} /ArtBox ${pdfBox(options.trimBox, options.pageHeight)}`
    : "";
  const created = pdfDate(options.creationDate);
  const title = pdfString(options.title?.trim() || "Book cover");
  const author = pdfString(options.author?.trim() || "Unknown author");

  push(`%PDF-${pdfx ? "1.6" : "1.4"}\n%\xE2\xE3\xCF\xD3\n`);
  beginObject(1);
  push(`<< /Type /Catalog /Pages 2 0 R${pdfx ? " /OutputIntents [6 0 R] /Metadata 7 0 R" : ""} >>\nendobj\n`);
  beginObject(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  beginObject(3);
  push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}]${boxes} /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`);
  beginObject(4);
  push(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  beginObject(5);
  push(`<< /Length ${contentBytes.length} >>\nstream\n`);
  push(contentBytes);
  push("endstream\nendobj\n");

  if (pdfx) {
    beginObject(6);
    push("<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier (sRGB IEC61966-2.1) /Info (sRGB IEC61966-2.1) /RegistryName (http://www.color.org) >>\nendobj\n");
    const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlString(options.title?.trim() || "Book cover")}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${xmlString(options.author?.trim() || "Unknown author")}</rdf:li></rdf:Seq></dc:creator>
   <pdf:Producer>NoteMe Cover Studio</pdf:Producer>
   <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
    const xmpBytes = new TextEncoder().encode(xmp);
    beginObject(7);
    push(`<< /Type /Metadata /Subtype /XML /Length ${xmpBytes.length} >>\nstream\n`);
    push(xmpBytes);
    push("\nendstream\nendobj\n");
    beginObject(8);
    push(`<< /Title (${title}) /Author (${author}) /Creator (NoteMe Cover Studio) /Producer (NoteMe Cover Studio) /CreationDate (${created}) /GTS_PDFXVersion (PDF/X-4) /Trapped /False >>\nendobj\n`);
  }

  const xrefStart = offset;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let index = 1; index <= objectCount; index += 1) push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  const id = fileId(jpeg, options);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R${pdfx ? " /Info 8 0 R" : ""} /ID [<${id}> <${id}>] >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return concat(chunks);
}

export async function buildCoverPdfFile(book: Book, cover: BookCoverDesign, options: { dpi?: number; marks?: boolean; pdfx?: boolean } = {}) {
  const marks = options.marks ?? true;
  const pdfx = options.pdfx ?? false;
  const slug = marks ? COVER_PDF_SLUG : 0;
  const dpi = Math.min(450, Math.max(72, Math.round(options.dpi ?? 300)));
  const canvas = await renderCoverCanvas(book, cover, "wrap", { dpi, bleed: true, marks, slug });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
  if (!blob) throw new Error("The print cover could not be generated.");
  const metrics = coverMetrics(book.trim_size, cover);
  const bytes = buildCoverPdf(new Uint8Array(await blob.arrayBuffer()), {
    pageWidth: metrics.fullWidth + slug * 2,
    pageHeight: metrics.fullHeight + slug * 2,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    pdfx,
    title: book.title,
    author: book.author,
    trimBox: {
      x: slug + metrics.bleed,
      y: slug + metrics.bleed,
      width: metrics.trimWidthTotal,
      height: metrics.trimHeight,
    },
    bleedBox: {
      x: slug,
      y: slug,
      width: metrics.fullWidth,
      height: metrics.fullHeight,
    },
  });
  const suffix = marks ? (pdfx ? "-print-x4.pdf" : "-print.pdf") : (pdfx ? "-x4.pdf" : ".pdf");
  return { bytes, filename: coverExportFilename(book, "wrap", "pdf").replace(/\.pdf$/, suffix) };
}

export async function downloadCoverPdf(book: Book, cover: BookCoverDesign, options: { dpi?: number; marks?: boolean; pdfx?: boolean } = {}) {
  const file = await buildCoverPdfFile(book, cover, options);
  return saveCoverBlob(new Blob([file.bytes], { type: "application/pdf" }), file.filename);
}
