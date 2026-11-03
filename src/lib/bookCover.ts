import type { Book } from "./types";
import type { BookCoverDesign, BookCoverLine, BookCoverTemplate, BookLayout, BookPublication } from "./bookLayout";

export interface ResolvedBookCover {
  template: BookCoverTemplate;
  masthead: string;
  kicker: string;
  headline: string;
  standfirst: string;
  issueLine: string;
  showIssueLine: boolean;
  coverLines: BookCoverLine[];
  price: string;
  showBarcode: boolean;
  alignment: BookCoverDesign["alignment"];
  textColor: string;
  accentColor: string;
  image: string;
  imageFit: BookCoverDesign["imageFit"];
  vignette: boolean;
  watermark: string;
}

export const BOOK_COVER_TEMPLATES: { id: BookCoverTemplate; label: string; description: string }[] = [
  { id: "masthead", label: "Masthead", description: "A commanding nameplate over bold editorial cover lines." },
  { id: "photo-led", label: "Photo-led", description: "A full-bleed image with the masthead floating above it." },
  { id: "type-led", label: "Type-led", description: "A typographic cover where the headline carries the issue." },
  { id: "minimal", label: "Minimal", description: "A quiet, centred cover with generous white space." },
];

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fontFamily(value: string) {
  if (value === "sans") return "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif";
  if (value === "mono") return "'SF Mono', 'Courier New', monospace";
  if (value === "humanist") return "Palatino, 'Palatino Linotype', serif";
  return "Georgia, 'Times New Roman', serif";
}

function hexChannels(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return { r: 165, g: 107, b: 62 };
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexChannels(hex);
  const channel = (value: number) => {
    const next = value / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function coverIssueLine(publication: BookPublication) {
  return [
    publication.volume ? `Volume ${publication.volume}` : "",
    publication.issue ? `Issue ${publication.issue}` : "",
    [publication.season, publication.year].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ");
}

export function resolveCover(book: Book, layout: BookLayout): ResolvedBookCover {
  const cover = layout.cover;
  const background = book.cover_color || "#a56b3e";
  const hasImage = Boolean(cover.image);
  const backgroundLightness = hasImage ? 0.24 : luminance(background);
  const textColor = cover.textColor || (backgroundLightness < 0.5 ? "#fffaf3" : "#211b16");
  return {
    template: cover.template,
    masthead: cover.masthead.trim() || book.title.trim() || "Untitled",
    kicker: cover.kicker.trim() || book.genre.trim(),
    headline: cover.headline.trim() || book.subtitle.trim(),
    standfirst: cover.standfirst.trim() || book.description.trim(),
    issueLine: cover.issueLine.trim() || coverIssueLine(layout.publication),
    showIssueLine: cover.showIssueLine,
    coverLines: cover.coverLines.filter((line) => line.label.trim() || line.text.trim()),
    price: cover.price.trim(),
    showBarcode: cover.showBarcode,
    alignment: cover.alignment,
    textColor,
    accentColor: cover.accentColor || (backgroundLightness < 0.5 ? "#f2c6a0" : layout.accentColor),
    image: cover.image,
    imageFit: cover.imageFit,
    vignette: cover.vignette,
    watermark: layout.publication.issue || layout.publication.year || layout.publication.volume,
  };
}

export function coverMarkup(book: Book, layout: BookLayout) {
  const cover = resolveCover(book, layout);
  const [trimWidth = 8.5, trimHeight = 11] = (book.trim_size || "8.5x11").split("x").map((value) => Number(value) || 0);
  const background = book.cover_color || "#a56b3e";
  const lines = cover.coverLines.map((line) => `<div class="book-cover-line">${line.label.trim() ? `<span class="book-cover-line-label">${escapeHtml(line.label)}</span>` : ""}${line.text.trim() ? `<span class="book-cover-line-text">${escapeHtml(line.text)}</span>` : ""}</div>`).join("");
  const image = cover.image ? `<div class="book-cover-image" style="background-image:url('${escapeHtml(cover.image)}');background-size:${cover.imageFit};"></div>` : "";
  return `<section class="book-cover-art template-${cover.template} align-${cover.alignment} ${cover.image ? "has-image" : ""} ${cover.vignette ? "has-vignette" : ""}" style="--cover-bg:${escapeHtml(background)};--cover-ink:${cover.textColor};--cover-accent:${cover.accentColor};--cover-font:${fontFamily(book.font_family)};--cover-aspect:${trimWidth} / ${trimHeight};">
  ${image}
  <div class="book-cover-inner">
    <header class="book-cover-top">
      ${cover.kicker ? `<p class="book-cover-kicker">${escapeHtml(cover.kicker)}</p>` : ""}
      <h1 class="book-cover-masthead">${escapeHtml(cover.masthead)}</h1>
      ${cover.showIssueLine && cover.issueLine ? `<p class="book-cover-issue"><span>${escapeHtml(cover.issueLine)}</span></p>` : ""}
    </header>
    ${cover.watermark ? `<span class="book-cover-watermark" aria-hidden="true">${escapeHtml(cover.watermark)}</span>` : ""}
    <div class="book-cover-middle">
      ${cover.headline ? `<p class="book-cover-headline">${escapeHtml(cover.headline)}</p>` : ""}
      ${cover.standfirst ? `<p class="book-cover-standfirst">${escapeHtml(cover.standfirst)}</p>` : ""}
    </div>
    <footer class="book-cover-bottom">
      ${lines ? `<div class="book-cover-lines">${lines}</div>` : ""}
      ${cover.showBarcode ? `<div class="book-cover-barcode" aria-label="Barcode"><span class="book-cover-bars"></span>${cover.price ? `<small>${escapeHtml(cover.price)}</small>` : ""}</div>` : ""}
    </footer>
  </div>
</section>`;
}

export function coverPageHtml(book: Book, layout: BookLayout) {
  return `<section class="book-cover-page">${coverMarkup(book, layout)}</section>`;
}

export function coverCss() {
  return `
.book-cover-page { width:100%; page-break-after: always; break-after: page; }
.book-cover-art { --cover-bg:#a56b3e; --cover-ink:#fffaf3; --cover-accent:#f2c6a0; --cover-font:Georgia, 'Times New Roman', serif; position:relative; display:flex; width:100%; aspect-ratio:var(--cover-aspect, 8.5 / 11); overflow:hidden; isolation:isolate; background:var(--cover-bg); color:var(--cover-ink); container-type:inline-size; font-family:var(--cover-font); }
.book-cover-art::before { position:absolute; inset:0; z-index:-1; background:radial-gradient(circle at 82% 12%, color-mix(in srgb, var(--cover-accent) 28%, transparent), transparent 52%), linear-gradient(145deg, transparent 38%, color-mix(in srgb, #000 18%, transparent)); content:""; pointer-events:none; }
.book-cover-art.has-image::before { background:linear-gradient(180deg, color-mix(in srgb, #000 20%, transparent), transparent 32%, transparent 45%, color-mix(in srgb, #000 58%, transparent)); }
.book-cover-art.has-image.has-vignette::after { position:absolute; inset:0; z-index:0; background:radial-gradient(ellipse at center, transparent 36%, color-mix(in srgb, #000 42%, transparent) 100%); content:""; pointer-events:none; }
.book-cover-image { position:absolute; inset:0; z-index:-2; background-position:center; background-repeat:no-repeat; }
.book-cover-inner { position:relative; z-index:1; display:flex; width:100%; flex-direction:column; justify-content:space-between; gap:4cqw; padding:7cqw; }
.book-cover-top { display:flex; flex-direction:column; gap:1.6cqw; }
.book-cover-kicker { margin:0; color:var(--cover-accent); font-family:inherit; font-size:clamp(7px, 1.8cqw, 15px); font-weight:700; letter-spacing:.22em; text-transform:uppercase; }
.book-cover-masthead { margin:0; color:var(--cover-ink); font-family:inherit; font-size:clamp(30px, 13cqw, 140px); font-weight:700; letter-spacing:-.065em; line-height:.86; text-wrap:balance; }
.book-cover-issue { display:flex; align-items:center; gap:2cqw; margin:0; color:var(--cover-ink); font-family:inherit; font-size:clamp(7px, 1.7cqw, 14px); font-weight:650; letter-spacing:.16em; text-transform:uppercase; }
.book-cover-issue::before { width:8cqw; height:1px; flex-shrink:0; background:var(--cover-accent); content:""; opacity:.8; }
.book-cover-middle { display:flex; max-width:86%; flex-direction:column; gap:2.4cqw; }
.book-cover-headline { margin:0; color:var(--cover-ink); font-family:inherit; font-size:clamp(20px, 6.6cqw, 68px); font-weight:600; letter-spacing:-.04em; line-height:1.02; text-wrap:balance; }
.book-cover-standfirst { max-width:44ch; margin:0; color:color-mix(in srgb, var(--cover-ink) 86%, transparent); font-family:inherit; font-size:clamp(8px, 2.05cqw, 17px); line-height:1.5; }
.book-cover-bottom { display:flex; align-items:flex-end; justify-content:space-between; gap:4cqw; }
.book-cover-lines { display:grid; max-width:72%; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:2.4cqw 4cqw; }
.book-cover-line { display:flex; flex-direction:column; gap:.5cqw; }
.book-cover-line-label { color:var(--cover-accent); font-family:inherit; font-size:clamp(6px, 1.5cqw, 12px); font-weight:750; letter-spacing:.16em; text-transform:uppercase; }
.book-cover-line-text { color:var(--cover-ink); font-family:inherit; font-size:clamp(8px, 2.15cqw, 18px); font-weight:550; line-height:1.25; }
.book-cover-barcode { display:flex; min-width:16cqw; flex-shrink:0; align-items:center; gap:1.2cqw; padding:1.3cqw 1.6cqw; flex-direction:column; background:#fff; color:#16120e; }
.book-cover-bars { display:block; width:100%; height:7.5cqw; background:repeating-linear-gradient(to right, #16120e 0 1px, transparent 1px 3px, #16120e 3px 5px, transparent 5px 8px, #16120e 8px 9px, transparent 9px 12px); }
.book-cover-barcode small { font-family:inherit; font-size:clamp(5px, 1.3cqw, 10px); font-weight:700; letter-spacing:.08em; }
.book-cover-watermark { position:absolute; right:2cqw; bottom:-4cqw; z-index:0; color:var(--cover-ink); font-family:inherit; font-size:58cqw; font-weight:700; letter-spacing:-.1em; line-height:.72; opacity:.075; pointer-events:none; user-select:none; }
.template-photo-led .book-cover-masthead { font-size:clamp(34px, 14.5cqw, 150px); }
.template-photo-led .book-cover-middle { margin-top:auto; }
.template-type-led .book-cover-masthead { font-size:clamp(15px, 4.2cqw, 36px); font-weight:650; letter-spacing:.18em; line-height:1.1; text-transform:uppercase; }
.template-type-led .book-cover-headline { font-size:clamp(32px, 11.5cqw, 116px); font-weight:650; letter-spacing:-.065em; line-height:.94; }
.template-type-led .book-cover-middle { max-width:96%; }
.template-type-led .book-cover-watermark { display:none; }
.template-minimal .book-cover-inner { justify-content:space-between; padding:8cqw; }
.template-minimal .book-cover-top { align-items:center; text-align:center; }
.template-minimal .book-cover-masthead { font-size:clamp(18px, 5.2cqw, 52px); font-weight:550; letter-spacing:.15em; line-height:1.1; text-transform:uppercase; }
.template-minimal .book-cover-issue { justify-content:center; }
.template-minimal .book-cover-middle { align-self:center; max-width:78%; align-items:center; text-align:center; }
.template-minimal .book-cover-headline { font-size:clamp(24px, 7.4cqw, 76px); font-weight:500; letter-spacing:-.035em; }
.template-minimal .book-cover-bottom { align-items:center; flex-direction:column; }
.template-minimal .book-cover-lines { max-width:100%; text-align:center; }
.template-minimal .book-cover-line { align-items:center; }
.template-minimal .book-cover-barcode { min-width:14cqw; }
.template-minimal .book-cover-watermark { display:none; }
.align-center .book-cover-inner { align-items:center; text-align:center; }
.align-center .book-cover-top { align-items:center; }
.align-center .book-cover-issue { justify-content:center; }
.align-center .book-cover-middle { align-self:center; align-items:center; max-width:82%; text-align:center; }
.align-center .book-cover-bottom { align-items:center; flex-direction:column; }
.align-center .book-cover-lines { max-width:100%; text-align:center; }
.align-center .book-cover-line { align-items:center; }
@page book-cover { margin: 0; }
.book-cover-page { page: book-cover; }
@media print {
  .book-cover-art { height: 100vh; aspect-ratio: auto; }
}
`;
}
