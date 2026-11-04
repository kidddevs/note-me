import type { Book } from "./types";
import type { BookCoverDesign } from "./bookLayout";
import { coverMetrics, renderCoverCanvas, saveCoverBlob } from "./bookCoverDoc";

export type CoverMockupBackground = "studio" | "transparent";

export interface CoverMockupOptions {
  width: number;
  height: number;
  background: CoverMockupBackground;
  caption?: boolean;
  dpi?: number;
}

export interface CoverMockupLayout {
  scale: number;
  bookHeight: number;
  frontWidth: number;
  spineWidth: number;
  bookWidth: number;
  left: number;
  top: number;
  caption: boolean;
}

export function coverMockupLayout(metrics: ReturnType<typeof coverMetrics>, width: number, height: number, caption: boolean): CoverMockupLayout {
  const maxWidth = width * 0.78;
  const maxHeight = height * (caption ? 0.64 : 0.78);
  const widthUnits = metrics.trimWidth + Math.max(0.06, metrics.spineWidth * 0.56);
  const scale = Math.min(maxHeight / metrics.trimHeight, maxWidth / widthUnits);
  const bookHeight = metrics.trimHeight * scale;
  const frontWidth = metrics.trimWidth * scale;
  const spineWidth = Math.max(8, metrics.spineWidth * scale * 0.56);
  const bookWidth = frontWidth + spineWidth;
  return {
    scale,
    bookHeight,
    frontWidth,
    spineWidth,
    bookWidth,
    left: (width - bookWidth) / 2,
    top: Math.max(24, (height - bookHeight) / 2 - (caption ? height * 0.035 : height * 0.01)),
    caption,
  };
}

export function coverMockupFilename(book: Book, options: Pick<CoverMockupOptions, "width" | "height" | "background">) {
  const title = (book.title || "untitled").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "untitled";
  const suffix = options.background === "transparent" ? "-transparent" : "";
  return `${title}-cover-mockup-${options.width}x${options.height}${suffix}.png`;
}

function drawCaption(ctx: CanvasRenderingContext2D, book: Book, width: number, height: number) {
  const baseY = height - Math.round(height * 0.075);
  const titleSize = Math.min(Math.round(width * 0.036), Math.round(height * 0.055));
  const labelSize = Math.max(10, Math.round(width * 0.0085));
  const authorSize = Math.max(9, Math.round(width * 0.011));
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c7a26e";
  ctx.font = `600 ${labelSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText("COVER MOCKUP", width / 2, baseY - Math.round(titleSize * 1.45));
  ctx.fillStyle = "rgba(199, 162, 110, 0.7)";
  ctx.fillRect(width / 2 - 24, baseY - Math.round(titleSize * 0.95), 48, 1);
  ctx.fillStyle = "#f5efe6";
  ctx.font = `500 ${titleSize}px Didot, Georgia, 'Times New Roman', serif`;
  ctx.fillText(book.title || "Untitled", width / 2, baseY, width * 0.84);
  if (book.author.trim()) {
    ctx.fillStyle = "rgba(245, 239, 230, 0.6)";
    ctx.font = `600 ${authorSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(book.author.toLocaleUpperCase(), width / 2, baseY + Math.round(titleSize * 0.9), width * 0.78);
  }
  ctx.restore();
}

export async function renderCoverMockup(book: Book, cover: BookCoverDesign, options: CoverMockupOptions): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined") throw new Error("Mockup rendering is only available in the app.");
  const width = Math.max(320, Math.round(options.width));
  const height = Math.max(320, Math.round(options.height));
  const caption = options.caption ?? options.background === "studio";
  const metrics = coverMetrics(book.trim_size, cover);
  const layout = coverMockupLayout(metrics, width, height, caption);
  const dpi = Math.min(300, Math.max(120, Math.round(options.dpi ?? 220)));
  const [front, spine] = await Promise.all([
    renderCoverCanvas(book, cover, "front", { dpi }),
    renderCoverCanvas(book, cover, "spine", { dpi }),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (options.background === "studio") {
    const background = ctx.createRadialGradient(width * 0.5, height * 0.32, 0, width * 0.5, height * 0.52, Math.max(width, height) * 0.82);
    background.addColorStop(0, "#403a33");
    background.addColorStop(0.5, "#1e1c19");
    background.addColorStop(1, "#090909");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.5, height * 0.3, 0, width * 0.5, height * 0.3, Math.max(width, height) * 0.54);
    glow.addColorStop(0, "rgba(228, 195, 146, 0.16)");
    glow.addColorStop(0.55, "rgba(228, 195, 146, 0.04)");
    glow.addColorStop(1, "rgba(228, 195, 146, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.24, width / 2, height / 2, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.46)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.filter = `blur(${Math.max(18, Math.round(layout.bookWidth * 0.045))}px)`;
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.beginPath();
  ctx.ellipse(width / 2 + layout.bookWidth * 0.03, layout.top + layout.bookHeight + 26, layout.bookWidth * 0.58, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pageEdge = Math.max(4, layout.bookHeight * 0.009);
  const frontX = layout.left + layout.spineWidth;
  const pages = ctx.createLinearGradient(frontX + layout.frontWidth, 0, frontX + layout.frontWidth + pageEdge, 0);
  pages.addColorStop(0, "#efe6d7");
  pages.addColorStop(0.55, "#d8ccb9");
  pages.addColorStop(1, "#bfb29e");
  ctx.fillStyle = pages;
  ctx.fillRect(frontX + layout.frontWidth - 1, layout.top + 2, pageEdge + 1, layout.bookHeight - 4);
  ctx.strokeStyle = "rgba(92, 78, 58, 0.22)";
  ctx.lineWidth = 0.7;
  for (let index = 1; index < 10; index += 1) {
    const y = layout.top + (layout.bookHeight / 10) * index;
    ctx.beginPath();
    ctx.moveTo(frontX + layout.frontWidth, y);
    ctx.lineTo(frontX + layout.frontWidth + pageEdge - 1, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(frontX + layout.frontWidth + pageEdge - 1.5, layout.top, 1.5, layout.bookHeight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.left, layout.top, layout.spineWidth, layout.bookHeight);
  ctx.clip();
  ctx.drawImage(spine, layout.left, layout.top, layout.spineWidth, layout.bookHeight);
  const spineShade = ctx.createLinearGradient(layout.left, 0, layout.left + layout.spineWidth, 0);
  spineShade.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  spineShade.addColorStop(0.28, "rgba(0, 0, 0, 0.08)");
  spineShade.addColorStop(0.72, "rgba(255, 255, 255, 0.09)");
  spineShade.addColorStop(1, "rgba(0, 0, 0, 0.26)");
  ctx.fillStyle = spineShade;
  ctx.fillRect(layout.left, layout.top, layout.spineWidth, layout.bookHeight);
  ctx.restore();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(layout.left - 1.5, layout.top, 1.5, layout.bookHeight);

  ctx.drawImage(front, frontX, layout.top, layout.frontWidth, layout.bookHeight);
  const sheen = ctx.createLinearGradient(frontX, layout.top, frontX + layout.frontWidth, layout.top + layout.bookHeight);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  sheen.addColorStop(0.3, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.78, "rgba(0, 0, 0, 0.03)");
  sheen.addColorStop(1, "rgba(0, 0, 0, 0.16)");
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = sheen;
  ctx.fillRect(frontX, layout.top, layout.frontWidth, layout.bookHeight);
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
  ctx.fillRect(frontX, layout.top, 1.2, layout.bookHeight);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fillRect(frontX + 1.2, layout.top, 1, layout.bookHeight);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(frontX, layout.top, layout.frontWidth, 1.2);
  ctx.fillRect(frontX, layout.top + layout.bookHeight - 1.2, layout.frontWidth, 1.2);

  if (caption) drawCaption(ctx, book, width, height);
  return canvas;
}

export async function downloadCoverMockup(book: Book, cover: BookCoverDesign, options: CoverMockupOptions) {
  const canvas = await renderCoverMockup(book, cover, options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The mockup image could not be generated.");
  return saveCoverBlob(blob, coverMockupFilename(book, options));
}
