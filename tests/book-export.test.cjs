const test = require("node:test");
const assert = require("node:assert/strict");
const { bookExportChecks } = require("./.compiled/src/lib/bookExport.js");

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

test("export preflight identifies actionable metadata and structure gaps", () => {
  const checks = bookExportChecks(
    book({ title: "Untitled manuscript", author: "", description: "" }),
    [chapter(1, "Chapter 1", ""), chapter(2, "Chapter 1", "")],
  );
  assert.deepEqual(checks.map((check) => check.id), ["title", "author", "description", "empty-sections", "duplicate-titles", "title-page"]);
  assert.equal(checks.find((check) => check.id === "empty-sections").chapterId, 1);
});
