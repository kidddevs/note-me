const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addMarkdownHeadingAnchors,
  buildBookToc,
  extractMarkdownHeadings,
} = require("./.compiled/src/lib/bookToc.js");

function book(overrides = {}) {
  return {
    id: 1,
    title: "A Book",
    subtitle: "",
    author: "",
    description: "",
    genre: "",
    status: "draft",
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
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function chapter(overrides = {}) {
  return {
    id: 4,
    book_id: 1,
    chapter_kind: "chapter",
    title: "Opening",
    content: "",
    position: 0,
    toc_include: true,
    toc_heading_exclusions: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

test("headings inside mixed or indented fences never leak into contents", () => {
  const markdown = [
    "# Visible",
    "```js",
    "~~~",
    "## Hidden in backtick fence",
    "```",
    "    ## Hidden indented code",
    "  ### Also visible",
  ].join("\n");
  assert.deepEqual(
    extractMarkdownHeadings(markdown, "section-4").map(({ label }) => label),
    ["Visible", "Also visible"],
  );
  const anchored = addMarkdownHeadingAnchors(markdown, "section-4");
  assert.equal((anchored.match(/<a id=/g) ?? []).length, 2);
  assert.doesNotMatch(anchored, /heading-2[^\n]*\n## Hidden/);
});

test("contents honors section and individual heading visibility", () => {
  const source = chapter({ content: "# Keep\n## Hide\n# Keep too" });
  const headings = extractMarkdownHeadings(source.content, "section-4");
  source.toc_heading_exclusions = [headings[1].key];
  const entries = buildBookToc(book(), [source]);
  assert.deepEqual(entries.map(({ label }) => label), ["Opening", "Keep", "Keep too"]);
  assert.deepEqual(buildBookToc(book({ toc_enabled: false }), [source]), []);
});
