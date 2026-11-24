const test = require("node:test");
const assert = require("node:assert/strict");
const { bookExportChecks, bookForExport, bookPackageSummary, customFontRequests, estimateBookPagination, groupBookExportChecks } = require("./.compiled/src/lib/bookExport.js");
const { layoutForBook } = require("./.compiled/src/lib/bookLayout.js");

function book(overrides = {}) {
  return {
    id: 1,
    title: "A Finished Book",
    subtitle: "",
    author: "A. Writer",
    description: "A concise reader-facing description.",
    genre: "Fiction",
    status: "ready",
    trim_size: "6x9",
    font_family: "serif",
    font_size: 12,
    line_height: 1.5,
    paragraph_spacing: 0,
    margin: 1,
    word_goal: 50000,
    cover_color: "#a56b3e",
    dedication: "",
    epigraph: "",
    copyright_text: "",
    acknowledgements: "",
    toc_enabled: true,
    toc_title: "Contents",
    toc_depth: 3,
    toc_include_front_matter: false,
    toc_include_back_matter: false,
    layout_json: "{}",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

function chapter(id, title, content, chapterKind = "chapter") {
  return { id, book_id: 1, chapter_kind: chapterKind, title, content, position: id, toc_include: true, toc_heading_exclusions: [], created_at: "2026-01-01", updated_at: "2026-01-01" };
}

test("export preflight stays clear for a complete reader package", () => {
  const chapters = [chapter(1, "A Finished Book", "By A. Writer", "title_page"), chapter(2, "The Arrival", "A complete opening chapter.")];
  assert.deepEqual(bookExportChecks(book(), chapters), []);
});

test("section plans do not appear in reader-facing exports", () => {
  const { bookMarkdown, bookHtml, bookText } = require("./.compiled/src/lib/bookPublishing.js");
  const chapters = [{ ...chapter(1, "The Arrival", "A complete opening chapter."), workflow_json: JSON.stringify({ status: "revising", wordGoal: 123456, dueDate: "2027-07-19" }) }];
  for (const render of [bookMarkdown, bookHtml, bookText]) assert.doesNotMatch(render(book(), chapters), /2027-07-19|workflow_json|"wordGoal"/);
});

test("export preflight identifies actionable metadata and structure gaps", () => {
  const checks = bookExportChecks(
    book({ title: "Untitled manuscript", author: "", description: "" }),
    [chapter(1, "Chapter 1", ""), chapter(2, "Chapter 1", "")],
  );
  assert.deepEqual(checks.map((check) => check.id), ["title", "author", "description", "empty-sections", "duplicate-titles", "title-page"]);
  assert.equal(checks.find((check) => check.id === "empty-sections").chapterId, 1);
});

test("package summary reports the reader promise before export", () => {
  const chapters = [
    chapter(1, "The Arrival", "A complete opening chapter.", "title_page"),
    { ...chapter(2, "The Arrival", "The second section has a photograph.\n\n![A street](data:image/png;base64,abc){credit=Studio Archive}"), workflow_json: JSON.stringify({ status: "ready", wordGoal: 0, dueDate: "" }) },
  ];
  const summary = bookPackageSummary(book(), chapters);
  assert.equal(summary.sections, 2);
  assert.equal(summary.words, 13);
  assert.equal(summary.readingMinutes, 1);
  assert.equal(summary.readySections, 1);
  assert.equal(summary.cover, "off");
  assert.equal(summary.contentsEntries, 2);
  assert.equal(summary.images, 1);
  assert.equal(summary.imageCredits, true);
  assert.ok(summary.estimatedPages >= 2);
  assert.deepEqual(summary.customFonts, []);
});

test("pagination estimate follows trim, typography, and section overrides", () => {
  const longSection = chapter(1, "The Arrival", Array(1800).fill("word").join(" "));
  const standard = estimateBookPagination(book(), [longSection]);
  const compact = estimateBookPagination(book({ trim_size: "5x8", margin: 1.25 }), [longSection]);
  const columns = estimateBookPagination(book({ layout_json: JSON.stringify({ typography: { paragraph: { columns: 2 } } }) }), [longSection]);
  assert.ok(standard.estimatedPages > 1);
  assert.ok(compact.estimatedPages >= standard.estimatedPages);
  assert.ok(columns.estimatedPages > 0);
  assert.notEqual(columns.textCapacity, standard.textCapacity);
  assert.equal(standard.sections.find((section) => section.chapterId === 1).chapterId, 1);
});

test("portable exports warn when a manuscript uses an installed font family", () => {
  const custom = book({ font_family: "Avenir Next, Helvetica Neue, sans-serif" });
  const epubChecks = bookExportChecks(custom, [chapter(1, "The Arrival", "A complete opening chapter.")], "epub");
  const fontCheck = epubChecks.find((check) => check.id === "font-portability");
  assert.equal(fontCheck.severity, "warning");
  assert.match(fontCheck.detail, /does not embed font binaries/);
  assert.equal(bookExportChecks(custom, [chapter(1, "The Arrival", "A complete opening chapter.")], "print").some((check) => check.id === "font-portability"), false);
});

test("licensed font opt-in clears the portability warning for matched files", () => {
  const custom = book({ font_family: "Avenir Next, Georgia, serif" });
  const check = bookExportChecks(custom, [chapter(1, "The Arrival", "A complete opening chapter.")], "epub", {
    embedFonts: true,
    embeddedFontFamilies: ["Avenir Next"],
  }).find((item) => item.id === "font-portability");
  assert.equal(check, undefined);
});

test("font portability requests preserve selected weight and italic style", () => {
  const custom = book({ layout_json: JSON.stringify({ typography: { paragraph: { fontFamily: "Avenir Next", fontWeight: 700, fontStyle: "italic" } } }) });
  const chapters = [chapter(1, "The Arrival", "A complete opening chapter.", "title_page")];
  const requests = customFontRequests(custom, layoutForBook(custom), chapters);
  const request = requests.find((item) => item.family === "Avenir Next");
  assert.deepEqual(request, { family: "Avenir Next", weight: 700, style: "italic" });
  assert.equal(bookExportChecks(custom, chapters, "docx", { embedFonts: true, embeddedFontRequests: [request] }).some((item) => item.id === "font-portability"), false);
});

test("portable summaries inspect section-level font overrides", () => {
  const section = {
    ...chapter(1, "The Arrival", "A complete opening chapter."),
    layout_json: JSON.stringify({ typography: { paragraph: { fontFamily: "Baskerville, Georgia, serif" } } }),
  };
  const summary = bookPackageSummary(book(), [section], "html");
  assert.deepEqual(summary.customFonts, ["Baskerville, Georgia, serif"]);
  assert.equal(bookExportChecks(book(), [section], "html").some((check) => check.id === "font-portability"), true);
});

test("preflight surfaces contradictory pagination rules", () => {
  const custom = book({ layout_json: JSON.stringify({ typography: { paragraph: { breakBefore: true, breakAfter: true } } }) });
  const check = bookExportChecks(custom, [chapter(1, "The Arrival", "A complete opening chapter.")], "print").find((item) => item.id === "pagination-rules");
  assert.equal(check.severity, "warning");
  assert.match(check.detail, /force a break/);
});

test("preflight groups attention items above finishing suggestions", () => {
  const checks = bookExportChecks(book({ author: "", description: "" }), [chapter(1, "The Arrival", "A complete opening chapter.")]);
  const groups = groupBookExportChecks(checks);
  assert.deepEqual(groups.attention.map((check) => check.id), ["author"]);
  assert.deepEqual(groups.suggestions.map((check) => check.id), ["description", "title-page"]);
});

test("an edition resolves cover and contents choices without altering the book", async () => {
  const { bookExportPayload } = require("./.compiled/src/lib/bookPublishing.js");
  const original = book({ layout_json: JSON.stringify({ cover: { enabled: true, masthead: "Cover masthead" } }) });
  const chapters = [chapter(1, "The Arrival", "A complete opening chapter.")];
  const edition = bookForExport(original, "html", { includeCover: false, includeContents: false });
  const html = await bookExportPayload(edition, chapters, "html");
  assert.doesNotMatch(html, /Cover masthead|<nav class="book-toc"/);
  assert.match(html, /A complete opening chapter/);
  assert.equal(bookPackageSummary(edition, chapters).contentsEntries, 0);
  assert.equal(bookPackageSummary(edition, chapters).cover, "off");
  assert.equal(layoutForBook(original).cover.enabled, true);
  assert.equal(original.toc_enabled, true);
  assert.equal(layoutForBook(bookForExport(original, "print")).cover.enabled, true);
  assert.equal(layoutForBook(bookForExport(original, "docx", { includeCover: true })).cover.enabled, false);
});

test("package artwork counts describe the actual selected format", () => {
  const sections = [chapter(1, "Images", [
    "![A plate](data:image/png;base64,AAAA){credit=Archive}",
    "![A sketch](data:image/webp;base64,AAAA)",
    "![A remote photo](https://example.com/photo.jpg)",
  ].join("\n\n"))];
  const word = bookPackageSummary(book(), sections, "docx");
  assert.equal(word.images, 1);
  assert.equal(word.imageDescriptions, 2);
  assert.equal(word.imageCredits, true);
  assert.equal(bookPackageSummary(book(), sections, "markdown").imageReferences, 3);
  const plain = bookPackageSummary(book(), sections, "txt");
  assert.equal(plain.images, 0);
  assert.equal(plain.imageDescriptions, 3);
});
