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
  canvasBlocks,
  canvasTextSource,
  imageMarkdown,
  markdownToHtml,
  paragraphStylesCss,
  restyleCanvasTextSource,
  richPresentationLeft,
  richAlignForLeft,
  alignedCanvasBox,
  wordCount,
  hasManuscriptContent,
  canvasParagraphBreak,
  chapterUsesFreeLayout,
  setChapterFreeLayout,
  EMPTY_CANVAS_PARAGRAPH,
  DEFAULT_RICH_PRESENTATION,
} = require("./.compiled/src/lib/bookPublishing.js");
const { DEFAULT_BOOK_LAYOUT, DEFAULT_BOOK_TYPOGRAPHY } = require("./.compiled/src/lib/bookLayout.js");

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
  assert.match(output, /@page \{ size: 6in 9in; margin: 1in 1in 1in 1in; \}/);
  assert.match(output, /class="book-toc"/);
  assert.match(output, /class="book-chrome"/);
  assert.match(output, /class="book-figure align-center" style="width:30%"/);
  assert.match(output, /class="book-image-frame radius-soft aspect-auto fit-contain"/);
  assert.ok(output.includes(`data:image/png;base64,${TINY_PNG}`));
  assert.match(visibleText(output), /The first light found the room/);
});

test("text frames can opt into full-bleed margins", () => {
  const source = canvasTextSource("A wide editorial note.", { ...DEFAULT_RICH_PRESENTATION, bleed: true });
  assert.match(source, /bleed=1/);
  const block = canvasBlocks(source).find((item) => item.kind === "text");
  assert.equal(block.presentation.bleed, true);
  const roundTrip = canvasTextSource(block.source, block.presentation);
  assert.match(roundTrip, /bleed=1/);
});

test("artwork backgrounds and full-bleed presentation round trip", () => {
  const markdown = imageMarkdown("Wide plate", `data:image/png;base64,${TINY_PNG}`, {
    radius: "none",
    align: "left",
    width: 100,
    aspect: "auto",
    fit: "contain",
    frame: "none",
    caption: "",
    bleed: true,
    backgroundColor: "#f3eadc",
  });
  assert.match(markdown, /bleed=1/);
  assert.match(markdown, /bg=%23f3eadc/);
  const html = markdownToHtml(markdown, undefined, DEFAULT_BOOK_TYPOGRAPHY);
  assert.match(html, /class="book-figure align-left bleed"/);
  assert.match(html, /style="background-color:#f3eadc"/);
});

test("paper patterns travel into HTML and print exports", () => {
  const patterned = book({ layout_json: JSON.stringify({ pagePattern: "dotted", pagePatternColor: "#6f7f6d", pagePatternSpacing: 0.3, pageColor: "#fffaf3" }) });
  const html = bookHtml(patterned, chapters());
  assert.match(html, /background-color: #fffaf3/);
  assert.match(html, /radial-gradient\(circle,#6f7f6d/);
  assert.match(html, /background-size:0\.3in 0\.3in/);
  const print = bookPrintHtml(patterned, chapters());
  assert.match(print, /print-color-adjust: exact/);
  assert.match(print, /background-color: #fffaf3/);
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

test("section page masters travel into HTML, EPUB, and named print pages", async () => {
  const featureLayout = JSON.stringify({
    pageColor: "#f3eadc",
    accentColor: "#356b5b",
    pageMargins: { top: 0.5, right: 0.6, bottom: 0.7, left: 0.8 },
  });
  const bookWithCover = book({ trim_size: "8.5x11" });
  const sectionChapters = [
    chapter(1, "The Slow Issue", "Issue 04 · Summer 2026", "cover", { layout_json: featureLayout }),
    chapter(2, "The Arrival", "Feature copy for the well."),
  ];
  const html = bookHtml(bookWithCover, sectionChapters);
  assert.match(html, /class="title-page book-page-1" style="--document-accent:#356b5b;background-color:#f3eadc;/);
  assert.match(html, /@page book-page-1\{size:8\.5in 11in;margin:0\.5in 0\.6in 0\.7in 0\.8in;\}/);
  assert.match(html, /\.book-page-1\{page:book-page-1;\}/);
  assert.match(html, /class="chapter book-page-2/);

  const files = textFiles(await bookEpub(bookWithCover, sectionChapters));
  assert.match(files["OEBPS/title-page.xhtml"], /<body style="margin:0\.5in 0\.6in 0\.7in 0\.8in;background-color:#f3eadc;--document-accent:#356b5b;/);
});

test("per-section running furniture overrides book chrome in HTML, EPUB, and print", async () => {
  const sectionLayout = JSON.stringify({
    header: { left: "Field Notes", center: "{{section}}", right: "" },
    footer: { left: "", center: "", right: "" },
    pageNumbering: { enabled: true, placement: "center", style: "roman-lower", start: 7, startSection: "story", customFormat: "Page {n}", rules: {} },
  });
  const sectionChapters = [
    chapter(1, "The Shape of Morning", "By A. Writer", "title_page"),
    chapter(2, "The Arrival", "Feature copy for the well.", "chapter", { layout_json: sectionLayout }),
    chapter(3, "A Pause", "A short interlude between movements.", "interlude"),
  ];
  const html = bookHtml(book(), sectionChapters);
  const feature = html.match(/<section id="section-2"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(feature, /class="book-chrome"/);
  assert.match(feature, /Field Notes/);
  assert.match(feature, /The Arrival/);
  assert.match(feature, /vii/);
  assert.doesNotMatch(feature, /A\. Writer/);
  const following = html.match(/<section id="section-3"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(following, /The Shape of Morning/);
  assert.match(following, /A\. Writer/);
  assert.match(bookPrintHtml(book(), sectionChapters), /Field Notes/);

  const files = textFiles(await bookEpub(book(), sectionChapters));
  assert.match(files["OEBPS/chapter-2.xhtml"], /Field Notes/);
  assert.match(files["OEBPS/chapter-2.xhtml"], /vii/);
  assert.doesNotMatch(files["OEBPS/chapter-2.xhtml"], /A\. Writer/);
  assert.match(files["OEBPS/chapter-3.xhtml"], /A\. Writer/);
});

test("designed covers travel into HTML and EPUB when enabled", async () => {
  const coverLayout = JSON.stringify({
    publication: { volume: "02", issue: "04", season: "Summer", year: "2026" },
    cover: {
      enabled: true,
      template: "masthead",
      masthead: "Field Notes",
      kicker: "The attention issue",
      headline: "The Slow Issue",
      issueLine: "Volume 02 · Issue 04 · Summer 2026",
      coverLines: [{ label: "Feature", text: "A case for slow looking" }],
      price: "$12",
      showBarcode: true,
      accentColor: "#f2c6a0",
    },
  });
  const coverBook = book({ layout_json: coverLayout, trim_size: "8.5x11", cover_color: "#7c2f24" });
  const html = bookHtml(coverBook, chapters());
  assert.match(html, /class="book-cover-page"/);
  assert.match(html, /Field Notes/);
  assert.match(html, /A case for slow looking/);
  assert.match(html, /@page book-cover/);
  assert.ok(html.indexOf('<section class="book-cover-page"') < html.indexOf('class="title-page', html.indexOf("</style>")));

  const files = textFiles(await bookEpub(coverBook, chapters()));
  assert.ok(files["OEBPS/cover.xhtml"]);
  assert.match(files["OEBPS/cover.xhtml"], /Field Notes/);
  assert.match(files["OEBPS/cover.xhtml"], /book-cover-bars/);
});

test("cover pages stay out of the export unless enabled", () => {
  const html = bookHtml(book(), chapters());
  assert.doesNotMatch(html, /class="book-cover-page"/);
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

test("canvas style changes preserve presentation and convert block roles", () => {
  const source = canvasTextSource("A small opening line.", { width: 60, align: "center" });
  const heading = restyleCanvasTextSource(source, "heading2", { width: 60, align: "center" });
  assert.match(heading, /^## A small opening line\./);
  assert.match(heading, /note-me:layout width=60 align=center/);
  assert.equal(canvasBlocks(heading)[0].role, "heading2");

  const quote = restyleCanvasTextSource(heading, "quote", { width: 60, align: "center" });
  assert.match(quote, /^> A small opening line\./);
  assert.equal(canvasBlocks(quote)[0].role, "quote");

  const paragraph = restyleCanvasTextSource(quote, "paragraph", { width: 100, align: "left" });
  assert.equal(paragraph, "A small opening line.");
});

test("canvas blocks keep a free horizontal offset inside the safe margins", () => {
  const source = canvasTextSource("A placed line.", { width: 60, align: "left", x: 23 });
  assert.match(source, /note-me:layout width=60 align=left x=23/);
  const block = canvasBlocks(source)[0];
  assert.equal(block.presentation.x, 23);
  assert.equal(block.presentation.width, 60);
  assert.equal(richPresentationLeft(block.presentation), 23);
  assert.equal(richAlignForLeft(0, 60), "left");
  assert.equal(richAlignForLeft(20, 60), "center");
  assert.equal(richAlignForLeft(40, 60), "right");
  assert.equal(richAlignForLeft(0, 100), "left");

  const clamped = canvasBlocks(canvasTextSource("Too far right.", { width: 60, align: "right", x: 95 }))[0];
  assert.equal(clamped.presentation.x, 40);

  const legacy = canvasBlocks(`${source.replace(" x=23", "")}\n`);
  assert.equal(legacy[0].presentation.x, undefined);
});

test("canvas paragraph breaks split blocks, keep styles, and create a typing target", () => {
  const source = canvasTextSource("A first line with more words.", { width: 60, align: "left", x: 12 });
  const block = canvasBlocks(source)[0];
  const split = canvasParagraphBreak(block, block.display.indexOf("more"), block.display.indexOf("more"));
  const parts = canvasBlocks(split.source);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].role, "paragraph");
  assert.equal(parts[1].role, "paragraph");
  assert.equal(parts[1].presentation.width, 60);
  assert.equal(parts[1].presentation.x, 12);

  const atEnd = canvasParagraphBreak(block, block.display.length, block.display.length);
  const endParts = canvasBlocks(atEnd.source);
  assert.equal(endParts.length, 2);
  assert.equal(endParts[1].display, EMPTY_CANVAS_PARAGRAPH);

  const heading = canvasBlocks("## A heading")[0];
  const headingParts = canvasBlocks(canvasParagraphBreak(heading, heading.display.length, heading.display.length).source);
  assert.equal(headingParts[0].role, "heading2");
  assert.equal(headingParts[1].role, "paragraph");

  const quote = canvasBlocks("> A quoted line")[0];
  const quoteParts = canvasBlocks(canvasParagraphBreak(quote, 3, 3).source);
  assert.equal(quoteParts[0].role, "quote");
  assert.equal(quoteParts[1].role, "quote");

  const removed = canvasParagraphBreak(canvasBlocks("Alpha beta gamma")[0], 6, 10);
  assert.deepEqual(canvasBlocks(removed.source).map((part) => part.display), ["Alpha", "gamma"]);
});

test("word count ignores empty-paragraph markers and hidden layout metadata", () => {
  const content = `A considered line. <!-- note-me:layout width=60 align=left x=18 -->\n\n\u200B <!-- note-me:layout width=40 align=right -->`;
  assert.equal(wordCount(content), 3);
  assert.equal(hasManuscriptContent(content), true);
  assert.equal(hasManuscriptContent("\u200B <!-- note-me:layout width=40 align=right -->"), false);
});

test("free layout positions and paragraph style references round trip", () => {
  const source = canvasTextSource("Feature copy", { width: 60, align: "left", x: 12, y: 24, height: 18, z: 5, styleId: "feature-opening" });
  const block = canvasBlocks(source)[0];
  assert.equal(block.presentation.x, 12);
  assert.equal(block.presentation.y, 24);
  assert.equal(block.presentation.height, 18);
  assert.equal(block.presentation.z, 5);
  assert.equal(block.presentation.styleId, "feature-opening");
  assert.match(source, /y=24/);
  assert.match(source, /height=18/);
  assert.match(source, /z=5/);
  assert.match(source, /style=feature-opening/);

  const free = setChapterFreeLayout(`${source}\n\nA second paragraph.`, true);
  assert.equal(chapterUsesFreeLayout(free), true);
  assert.equal(canvasBlocks(free).length, 2);
  assert.doesNotMatch(markdownToHtml(free), /free-layout/);
  assert.equal(chapterUsesFreeLayout(setChapterFreeLayout(free, false)), false);
});

test("canvas typography carries drop caps and nested openings into preview markup", () => {
  const typography = {
    ...DEFAULT_BOOK_TYPOGRAPHY,
    paragraph: {
      ...DEFAULT_BOOK_TYPOGRAPHY.paragraph,
      dropCap: true,
      nestedStyle: "small-caps",
      nestedWords: 2,
    },
  };
  const html = markdownToHtml("First light crossed the room.", undefined, typography);
  assert.match(html, /class="book-paragraph has-drop-cap"/);
  assert.match(html, /<span class="book-nested-style nested-small-caps">First<\/span> <span class="book-nested-style nested-small-caps">light<\/span>/);
});

test("named paragraph styles survive into exported HTML and print CSS", () => {
  const source = canvasTextSource("A standfirst for the feature.", { styleId: "body-modern" });
  const html = markdownToHtml(source, undefined, DEFAULT_BOOK_TYPOGRAPHY, DEFAULT_BOOK_LAYOUT.paragraphStyles);
  assert.match(html, /class="book-paragraph book-style-body-modern"/);
  assert.doesNotMatch(html, /note-me:layout/);

  const css = paragraphStylesCss(DEFAULT_BOOK_LAYOUT);
  assert.match(css, /\.book-style-body-modern\{/);
  assert.match(css, /\.book-style-feature-opening\.has-drop-cap::first-letter/);

  const exportCss = paragraphStylesCss({ ...DEFAULT_BOOK_LAYOUT, paragraphStyles: [{ id: "folio", name: "Folio", style: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph, textAlign: "center", textCase: "uppercase", widows: 3 } }] }, ".book-print-content");
  assert.match(exportCss, /\.book-print-content \.book-style-folio\{/);
  assert.match(exportCss, /widows:3/);
  assert.match(exportCss, /text-transform:uppercase/);
});

test("inline underline and strikethrough survive Markdown rendering", () => {
  const html = markdownToHtml("A ~~struck~~ note with ++underlined++ words.");
  assert.match(html, /<s>struck<\/s>/);
  assert.match(html, /<u>underlined<\/u>/);
});

test("multi-object alignment resolves edge and center positions", () => {
  const boxes = [
    { left: 10, top: 5, width: 30, height: 10 },
    { left: 50, top: 30, width: 20, height: 20 },
  ];
  const bounds = {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.left + box.width)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.top + box.height)),
  };
  assert.deepEqual(alignedCanvasBox(boxes[0], bounds, "left"), { x: 10, y: 5 });
  assert.deepEqual(alignedCanvasBox(boxes[0], bounds, "center"), { x: 25, y: 5 });
  assert.deepEqual(alignedCanvasBox(boxes[0], bounds, "right"), { x: 40, y: 5 });
  assert.deepEqual(alignedCanvasBox(boxes[0], bounds, "top"), { x: 10, y: 5 });
  assert.deepEqual(alignedCanvasBox(boxes[0], bounds, "middle"), { x: 10, y: 22.5 });
  assert.deepEqual(alignedCanvasBox(boxes[0], bounds, "bottom"), { x: 10, y: 40 });
});

test("artwork keeps the free horizontal offset in portable attributes", () => {
  const markdown = imageMarkdown("A placed figure", "https://example.com/art.png", {
    radius: "none",
    align: "left",
    width: 50,
    height: 38,
    x: 12,
    y: 22,
    z: 3,
    aspect: "auto",
    fit: "contain",
    frame: "none",
    caption: "",
    cornerRadius: 14,
    borderWidth: 2,
    borderColor: "#111111",
    borderStyle: "dashed",
    shadow: "soft",
    opacity: 0.8,
    rotation: 3,
  });
  assert.match(markdown, /width=50 h=38 x=12 y=22 z=3/);
  assert.match(markdown, /corner=14 bw=2 bc=#111111 bs=dashed shadow=soft opacity=0.8 rotate=3/);
  const block = canvasBlocks(markdown)[0];
  assert.equal(block.presentation.x, 12);
  assert.equal(block.presentation.y, 22);
  assert.equal(block.presentation.z, 3);
  assert.equal(block.image.presentation.height, 38);
  assert.equal(block.image.presentation.cornerRadius, 14);
  assert.equal(block.image.presentation.shadow, "soft");
  assert.equal(richPresentationLeft(block.presentation), 12);

  const appended = canvasBlocks(imageMarkdown("A placed figure", "https://example.com/art.png", {
    radius: "none", align: "right", width: 50, x: 999, aspect: "auto", fit: "contain", frame: "none", caption: "",
  }))[0];
  assert.equal(appended.presentation.x, 50);
});

test("artwork runaround and full bleed metadata round trip", () => {
  const markdown = imageMarkdown("A wrapped figure", "https://example.com/art.png", {
    radius: "soft",
    align: "left",
    width: 42,
    aspect: "landscape",
    fit: "cover",
    frame: "hairline",
    caption: "A wrapped caption",
    wrap: "left",
    wrapGap: 1.8,
  });
  assert.match(markdown, /wrap=left wrapgap=1.8/);
  const block = canvasBlocks(markdown)[0];
  assert.equal(block.image.presentation.wrap, "left");
  assert.equal(block.image.presentation.wrapGap, 1.8);
  assert.equal(block.image.presentation.bleed, undefined);
  const html = markdownToHtml(markdown);
  assert.match(html, /class="book-figure align-left wrap-left"/);
  assert.match(html, /margin-right:1.8em/);

  const bleed = imageMarkdown("A full bleed figure", "https://example.com/bleed.png", {
    radius: "none",
    align: "left",
    width: 100,
    aspect: "wide",
    fit: "cover",
    frame: "none",
    caption: "",
    bleed: true,
  });
  assert.match(bleed, /bleed=1/);
  const bleedBlock = canvasBlocks(bleed)[0];
  assert.equal(bleedBlock.image.presentation.bleed, true);
  assert.doesNotMatch(bleed, /wrap=/);
  assert.match(markdownToHtml(bleed), /class="book-figure align-left bleed"/);
});

test("artwork presentation metadata round trips into export markup", () => {
  const markdown = imageMarkdown("A figure", "https://example.com/art.png", {
    radius: "soft",
    align: "left",
    width: 60,
    aspect: "wide",
    fit: "cover",
    frame: "mat",
    caption: "A considered caption",
  });
  assert.match(markdown, /aspect=wide/);
  assert.match(markdown, /frame=mat/);
  assert.match(markdown, /caption=A%20considered%20caption/);
  const html = markdownToHtml(markdown);
  assert.match(html, /^<figure /);
  assert.match(html, /class="book-image-frame radius-soft aspect-wide fit-cover frame-mat"/);
  assert.match(html, /<figcaption>A considered caption<\/figcaption>/);
  assert.doesNotMatch(html, /<p[^>]*><figure/);
});

const { imageMarkdownFromAsset, imageFrameAspectRatio, replaceImageMarkdown } = require("./.compiled/src/lib/bookPublishing.js");

const photo = { name: "The coast", src: `data:image/png;base64,${TINY_PNG}`, width: 2400, height: 1600, alt: 'The coast & "sky"', credit: "Photo: Amelia & Hart", license: "Private archive / print permission" };

test("library placements carry source details into portable manuscript content", () => {
  const markdown = imageMarkdownFromAsset(photo);
  const parsed = canvasBlocks(markdown)[0].image;
  assert.equal(parsed.alt, photo.alt);
  assert.equal(parsed.presentation.sourceWidth, 2400);
  assert.equal(parsed.presentation.sourceHeight, 1600);
  assert.equal(parsed.presentation.credit, photo.credit);
  assert.equal(parsed.presentation.license, photo.license);
  const html = markdownToHtml(markdown);
  assert.match(html, /alt="The coast &amp; &quot;sky&quot;"/);
  assert.match(html, /<span class="book-image-credit">Photo: Amelia &amp; Hart<\/span>/);
  assert.doesNotMatch(html, /Private archive/);
});

test("page image crop focus and height survive HTML, print and EPUB", async () => {
  const markdown = imageMarkdownFromAsset(photo, { radius: "soft", align: "center", width: 60, height: 40, aspect: "square", fit: "cover", frame: "hairline", caption: "The morning tide", focusX: 0.9, focusY: 0.2, cornerRadius: 12, borderWidth: 2, borderColor: "#123456", opacity: 0.7, rotation: -5, shadow: "soft" });
  const manuscript = book({ layout_json: JSON.stringify({ ...DEFAULT_BOOK_LAYOUT, cover: { ...DEFAULT_BOOK_LAYOUT.cover, enabled: false } }) });
  const sections = [chapter(1, "Photo story", markdown)];
  const html = bookHtml(manuscript, sections);
  const print = bookPrintHtml(manuscript, sections);
  for (const output of [html, print]) {
    assert.match(output, /object-position:90% 20%/);
    assert.match(output, /aspect-ratio:60\/40/);
    assert.match(output, /border-radius:12px/);
    assert.match(output, /border:2px solid #123456/);
    assert.match(output, /opacity:0.7/);
    assert.match(output, /transform:rotate\(-5deg\)/);
    assert.match(output, /Photo: Amelia &amp; Hart/);
  }
  const epub = unzipSync(await bookEpub(manuscript, sections));
  const pages = Object.entries(epub).filter(([name]) => name.endsWith(".xhtml")).map(([, bytes]) => strFromU8(bytes)).join("\n");
  assert.match(pages, /object-position:90% 20%/);
  assert.match(pages, /Photo: Amelia &amp; Hart/);
});

test("image focus clamps finite values and safely defaults legacy or malformed metadata", () => {
  const extreme = canvasBlocks('![Photo](https://example.com/photo.png){fx=-2 fy=7 sw=2400 sh=1600}')[0].image.presentation;
  assert.equal(extreme.focusX, 0);
  assert.equal(extreme.focusY, 1);
  const invalid = canvasBlocks('![Photo](https://example.com/photo.png){fx=NaN fy=Infinity sw=Infinity sh=-10}')[0].image.presentation;
  assert.equal(invalid.focusX, undefined);
  assert.equal(invalid.focusY, undefined);
  assert.equal(invalid.sourceWidth, undefined);
  assert.equal(invalid.sourceHeight, 0);
  assert.match(markdownToHtml('![Photo](https://example.com/photo.png)'), /object-position:50% 50%/);
});

test("replacement images keep geometry and captions while replacing attribution", () => {
  const original = imageMarkdown("Old", "https://example.com/old.png", { radius: "round", align: "left", width: 55, height: 35, x: 12, y: 26, z: 7, aspect: "wide", fit: "cover", frame: "mat", focusX: 0.7, caption: "Our story", credit: "Old photographer", license: "Old license" });
  const replaced = replaceImageMarkdown(original, imageMarkdownFromAsset(photo));
  const parsed = canvasBlocks(replaced)[0].image;
  assert.equal(parsed.source, photo.src);
  for (const [key, expected] of Object.entries({ width: 55, height: 35, x: 12, y: 26, z: 7, frame: "mat", focusX: 0.7, caption: "Our story", credit: photo.credit, license: photo.license, sourceWidth: 2400 })) assert.equal(parsed.presentation[key], expected, key);
  const uncredited = canvasBlocks(replaceImageMarkdown(original, "![New](https://example.com/new.png)"))[0].image;
  assert.equal(uncredited.presentation.credit, undefined);
  assert.equal(uncredited.presentation.license, undefined);
  assert.equal(uncredited.presentation.sourceWidth, undefined);
  assert.equal(replaceImageMarkdown(original, "Plain text"), null);
});

test("crop preview proportions follow the same explicit height, shape and source rules", () => {
  const defaults = { radius: "none", align: "center", width: 60, aspect: "auto", fit: "contain", frame: "none", caption: "" };
  assert.equal(imageFrameAspectRatio({ ...defaults, height: 30, aspect: "portrait" }), 2);
  assert.equal(imageFrameAspectRatio({ ...defaults, aspect: "portrait" }), 0.75);
  assert.equal(imageFrameAspectRatio({ ...defaults, sourceWidth: 2400, sourceHeight: 1600 }), 1.5);
  assert.equal(imageFrameAspectRatio(defaults), undefined);
});

test("Word exports retain photo credits below embedded artwork", async () => {
  const files = textFiles(await bookDocx(book(), [chapter(1, "Photo story", imageMarkdownFromAsset(photo))]));
  assert.match(files["word/document.xml"], /Photo: Amelia &amp; Hart/);
  assert.doesNotMatch(files["word/document.xml"], /Private archive/);
});

test("photo attributes remain literal and XML-safe when they contain Markdown punctuation", () => {
  const { JSDOM } = require("jsdom");
  const alt = 'A **bold** coast & "sky" <archive>';
  const src = 'https://example.com/a_b_c.png?one=1&two=2';
  const html = markdownToHtml(imageMarkdown(alt, src, { radius: "none", align: "center", width: 100, aspect: "auto", fit: "contain", frame: "none", caption: "A **literal** caption", credit: "Amelia * Hart" }));
  const dom = new JSDOM(`<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`, { contentType: "application/xhtml+xml" });
  assert.equal(dom.window.document.querySelector("img").getAttribute("alt"), alt);
  assert.equal(dom.window.document.querySelector("img").getAttribute("src"), src);
  assert.match(dom.window.document.querySelector("figcaption").textContent, /A \*\*literal\*\* caption/);
  assert.equal(dom.window.document.querySelector("strong"), null);
  dom.window.close();
  assert.doesNotMatch(markdownToHtml('`![example](https://example.com/a.png)`'), /<figure/);
});
