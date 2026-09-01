const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { unzipSync, strFromU8 } = require("fflate");
const {
  bookExportPayload,
  bookDocx,
  bookEpub,
  bookHtml,
  bookMarkdown,
  bookPrintHtml,
  bookText,
} = require("./.compiled/src/lib/bookPublishing.js");

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function book(overrides = {}) {
  return {
    id: 7,
    title: "The Shape of Morning",
    subtitle: "A small study in light",
    author: "A. Writer",
    description: "A concise reader-facing description.",
    genre: "Literary fiction",
    status: "ready",
    trim_size: "6x9",
    font_family: "serif",
    font_size: 12,
    line_height: 1.5,
    paragraph_spacing: 0.4,
    margin: 1,
    word_goal: 50000,
    cover_color: "#a56b3e",
    dedication: "For the early risers.",
    epigraph: "The day begins before we name it.",
    copyright_text: "Copyright 2026 A. Writer.",
    acknowledgements: "Thanks to every careful reader.",
    toc_enabled: true,
    toc_title: "Contents",
    toc_depth: 3,
    toc_include_front_matter: true,
    toc_include_back_matter: true,
    layout_json: JSON.stringify({
      header: { left: "{{title}}", center: "{{section}}", right: "{{page}}" },
      footer: { left: "", center: "A. Writer", right: "" },
      pageNumbering: { enabled: true, placement: "right", style: "roman-lower", start: 1, startSection: "story", customFormat: "Page {n}", rules: {} },
      typography: { paragraph: { nestedStyle: "small-caps", nestedWords: 2, dropCap: true, dropCapLines: 3, nestedColor: "#a56b3e" } },
    }),
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

function chapter(id, title, content, chapterKind = "chapter", overrides = {}) {
  return {
    id,
    book_id: 7,
    chapter_kind: chapterKind,
    title,
    content,
    position: id,
    toc_include: true,
    toc_heading_exclusions: [],
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

function chapters() {
  return [
    chapter(1, "The Shape of Morning", "By A. Writer", "title_page"),
    chapter(2, "The Arrival", `A **quiet** beginning.

## The Door

The first light found the room before she did.

> The day is already waiting.

![A tiny image](data:image/png;base64,${TINY_PNG}){radius=soft align=center width=30}`),
    chapter(3, "A Pause", "A short interlude between movements.", "interlude"),
    chapter(4, "About the author", "A. Writer writes about rooms, weather, and patient beginnings.", "about_author"),
  ];
}

function textFiles(bytes) {
  return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([path, value]) => [path, strFromU8(value)]));
}

function visibleText(markup) {
  return markup.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function findCommand(candidates, args = ["--version"]) {
  const commands = candidates.filter(Boolean);
  return commands.find((candidate) => {
    try {
      execFileSync(candidate, args, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }) ?? null;
}

function findSoffice() {
  return findCommand([process.env.NOTEME_SOFFICE, "soffice", "libreoffice"]);
}

function findPdfinfo() {
  return findCommand([process.env.NOTEME_PDFINFO, "pdfinfo"]);
}

function findPdftotext() {
  return findCommand([process.env.NOTEME_PDFTOTEXT, "pdftotext"]);
}

test("Markdown export preserves portable metadata, anchors, and contents", () => {
  const output = bookMarkdown(book(), chapters());
  assert.match(output, /^---\ntitle: "The Shape of Morning"/);
  assert.match(output, /## Contents/);
  assert.match(output, /\[The Arrival\]\(#section-2\)/);
  assert.match(output, /<a id="section-2"><\/a>\n# Chapter 1: The Arrival/);
  assert.match(output, /<a id="section-2-heading-1"><\/a>\n## The Door/);
});

test("HTML export includes print geometry, book chrome, rich blocks, and embedded media", () => {
  const output = bookHtml(book(), chapters());
  assert.match(output, /^<!doctype html>/);
  assert.match(output, /@page \{ size: 6in 9in; margin: 1in; \}/);
  assert.match(output, /class="book-toc"/);
  assert.match(output, /class="book-chrome"/);
  assert.match(output, /class="book-image radius-soft align-center"/);
  assert.ok(output.includes(`data:image/png;base64,${TINY_PNG}`));
  assert.match(visibleText(output), /The first light found the room/);
});

test("plain-text export removes presentation markup while retaining reader content", () => {
  const output = bookText(book(), chapters());
  assert.match(output, /The Shape of Morning/);
  assert.match(output, /Chapter 1: The Arrival/);
  assert.match(output, /The Door/);
  assert.match(output, /\[Image: A tiny image\]/);
  assert.doesNotMatch(output, /data:image\/png/);
  assert.doesNotMatch(output, /note-me:layout/);
});

test("print HTML adds an explicit print contract to the styled book document", () => {
  const output = bookPrintHtml(book(), chapters());
  assert.match(output, /id="noteme-print-contract"/);
  assert.match(output, /@media print/);
  assert.match(output, /\.title-page \{ page-break-after: always; \}/);
  assert.match(output, /@page \{ size: 6in 9in/);
});

test("EPUB export is a readable EPUB 3 package with navigation and media", async () => {
  const files = textFiles(await bookEpub(book(), chapters()));
  assert.ok(files.mimetype);
  assert.equal(files.mimetype, "application/epub+zip");
  assert.ok(files["META-INF/container.xml"]);
  assert.ok(files["OEBPS/content.opf"]);
  assert.ok(files["OEBPS/nav.xhtml"]);
  assert.ok(files["OEBPS/title-page.xhtml"]);
  assert.ok(files["OEBPS/chapter-2.xhtml"]);
  assert.ok(files["OEBPS/chapter-3.xhtml"]);
  assert.ok(files["OEBPS/chapter-4.xhtml"]);
  assert.ok(files["OEBPS/images/image1.png"]);
  assert.match(files["OEBPS/content.opf"], /version="3\.0"/);
  assert.match(files["OEBPS/content.opf"], /properties="nav"/);
  assert.match(files["OEBPS/content.opf"], /image-1/);
  assert.match(files["OEBPS/nav.xhtml"], /The Arrival/);
  assert.match(visibleText(files["OEBPS/chapter-2.xhtml"]), /The first light found the room/);
  assert.match(files["OEBPS/chapter-2.xhtml"], /src="images\/image1\.png"/);
});

test("DOCX export is a readable Word package with styles, chrome, and media", async () => {
  const files = textFiles(await bookDocx(book(), chapters()));
  assert.ok(files["[Content_Types].xml"]);
  assert.ok(files["word/document.xml"]);
  assert.ok(files["word/styles.xml"]);
  assert.ok(files["word/header1.xml"]);
  assert.ok(files["word/footer1.xml"]);
  assert.ok(files["word/media/image1.png"]);
  assert.match(visibleText(files["word/document.xml"]), /The first light found the room/);
  assert.match(files["word/document.xml"], /Chapter 1: The Arrival/);
  assert.match(files["word/styles.xml"], /Heading1/);
  assert.match(files["word/footer1.xml"], /A\. Writer/);
  assert.match(files["word/_rels/document.xml.rels"], /relationships\/image/);
});

test("export dispatcher writes every file-level reader format", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "noteme-book-export-"));
  const formats = [
    ["markdown", ".md"],
    ["html", ".html"],
    ["txt", ".txt"],
    ["epub", ".epub"],
    ["docx", ".docx"],
  ];
  try {
    for (const [format, extension] of formats) {
      const payload = await bookExportPayload(book(), chapters(), format);
      const outputPath = path.join(tempDir, `shape-of-morning${extension}`);
      fs.writeFileSync(outputPath, payload);
      const output = fs.readFileSync(outputPath);
      assert.ok(output.length > 0, `${format} should produce a non-empty file`);
      if (format === "markdown") assert.match(output.toString("utf8"), /^---\ntitle:/);
      if (format === "html") assert.match(output.toString("utf8"), /^<!doctype html>/);
      if (format === "txt") assert.match(output.toString("utf8"), /The Shape of Morning/);
      if (format === "epub") assert.equal(strFromU8(unzipSync(output).mimetype), "application/epub+zip");
      if (format === "docx") assert.ok(unzipSync(output)["word/document.xml"]);
    }
    const printPath = path.join(tempDir, "shape-of-morning-print.html");
    fs.writeFileSync(printPath, bookPrintHtml(book(), chapters()), "utf8");
    const printOutput = fs.readFileSync(printPath, "utf8");
    assert.match(printOutput, /id="noteme-print-contract"/);
    assert.match(printOutput, /@page \{ size: 6in 9in/);
    const soffice = findSoffice();
    if (soffice) {
      execFileSync(soffice, ["--headless", "--convert-to", "pdf", "--outdir", tempDir, printPath], { stdio: "ignore" });
      const pdfPath = path.join(tempDir, "shape-of-morning-print.pdf");
      assert.match(fs.readFileSync(pdfPath).subarray(0, 5).toString(), /^%PDF-/);
      const pdfinfo = findPdfinfo();
      if (pdfinfo) assert.match(execFileSync(pdfinfo, [pdfPath], { encoding: "utf8" }), /Pages:\s+[1-9]/);
      const pdftotext = findPdftotext();
      if (pdftotext) assert.match(execFileSync(pdftotext, [pdfPath, "-"], { encoding: "utf8" }), /The first light found the room/);
    } else {
      assert.equal(process.env.NOTEME_REQUIRE_PDF, undefined, "LibreOffice is required for PDF output verification");
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
