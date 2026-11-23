const test = require("node:test");
const assert = require("node:assert/strict");
const { searchBookManuscript, manuscriptSections, resolveManuscriptDestination } = require("./.compiled/src/lib/bookManuscriptNavigation.js");
const { findManuscriptMatches, manuscriptMatchExcerpts } = require("./.compiled/src/lib/bookManuscriptSearch.js");
const { canvasTextSource, DEFAULT_RICH_PRESENTATION } = require("./.compiled/src/lib/bookPublishing.js");
const { buildBookToc, extractMarkdownHeadings } = require("./.compiled/src/lib/bookToc.js");

const chapter = (id, content, overrides = {}) => ({ id, book_id: -701, chapter_kind: "chapter", title: `Section ${id}`, content, position: id, toc_include: true, toc_heading_exclusions: [], layout_json: "", created_at: "", updated_at: "", ...overrides });

test("book search follows document bands and order, counts all matches and bounds rows", () => {
  const chapters = [chapter(8, "Coast coast coastline", { chapter_kind: "colophon", position: 0 }), chapter(2, "The coast remembers coast."), chapter(1, "Coast", { chapter_kind: "title_page", position: 99 })];
  const original = structuredClone(chapters);
  const result = searchBookManuscript(chapters, "coast", { wholeWord: true }, 2);
  assert.equal(result.total, 5);
  assert.equal(result.shown, 2);
  assert.deepEqual(result.sections.map((section) => section.chapter.id), [1, 2, 8]);
  assert.deepEqual(result.sections.map((section) => section.matches.length), [1, 1, 0]);
  assert.equal(searchBookManuscript(chapters, "Coast", { matchCase: true, wholeWord: true }).total, 2);
  assert.equal(searchBookManuscript(chapters, "coast", {}, 0).shown, 0);
  assert.equal(searchBookManuscript(chapters, "coast", {}, -10).shown, 0);
  assert.equal(searchBookManuscript(chapters, " ").total, 0);
  assert.deepEqual(chapters, original);
});

test("book search and excerpts never expose artwork, portable attributes, links or code", () => {
  const styled = canvasTextSource("Visible coast and [coast](https://coast.example/SECRET_URL)", { ...DEFAULT_RICH_PRESENTATION, styleId: "coast-hidden-style" });
  const content = `${styled}\n\n![coast image](data:image/png;base64,SECRET_COAST_IMAGE)\n\n~~~text\ncoast SECRET_CODE\n~~~\n\nFinal coast paragraph.`;
  const result = searchBookManuscript([chapter(1, content)], "coast");
  assert.equal(result.total, 3);
  const snippets = JSON.stringify(result.sections[0].matches.map((match) => match.excerpt));
  assert.doesNotMatch(snippets, /SECRET|https:|base64|styleId|hidden-style|data:image/);
  const first = result.sections[0].matches[0].excerpt;
  assert.equal(first.before + first.match + first.after, "Visible coast and ");
  for (const match of result.sections[0].matches) assert.equal(content.slice(match.start, match.end), "coast");
});

test("fences respect marker type and length, including unclosed code", () => {
  const content = "Outside needle\n\n````md\n```\nneedle hidden\n~~~\n````\n\nOutside needle\n\n~~~\nneedle hidden forever";
  const matches = findManuscriptMatches(content, "needle");
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((match) => content.slice(match.start - 8, match.end)), ["Outside needle", "Outside needle"]);
});

test("navigation includes headings outside reader contents and filters without mutating inclusion", () => {
  const chapters = [chapter(1, "## The shore\n\nText\n\n### Quiet water", { toc_include: false }), chapter(2, "## Inland")];
  const headings = extractMarkdownHeadings(chapters[0].content, "section-1");
  chapters[0].toc_heading_exclusions = [headings[0].key];
  const original = structuredClone(chapters);
  const filtered = manuscriptSections(chapters, "quiet");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].headings[0].label, "Quiet water");
  assert.equal(manuscriptSections(chapters, "section 1")[0].headings.length, 2);
  assert.equal(manuscriptSections(chapters, "absent").length, 0);
  assert.deepEqual(chapters, original);
});

test("heading destinations handle duplicate identities, CRLF and astral source offsets", () => {
  const content = "😀 Opening\r\n\r\n## Coast\r\n\r\nParagraph\r\n\r\n## Coast\r\n\r\nFinal";
  const headings = extractMarkdownHeadings(content, "chapter-1");
  assert.equal(headings.length, 2);
  assert.equal(headings[1].start, content.lastIndexOf("## Coast"));
  assert.notEqual(headings[0].key, headings[1].key);
  const resolved = resolveManuscriptDestination(content, { kind: "heading", key: headings[1].key });
  assert.equal(resolved.stale, false);
  assert.equal(resolved.block.start, headings[1].start);
  assert.equal(resolved.block.level, 2);
  const missing = resolveManuscriptDestination(content, { kind: "heading", key: "deleted" });
  assert.equal(missing.block, null);
  assert.equal(missing.stale, true);
});

test("heading destinations retain portable styling and exclude fenced examples", () => {
  const heading = canvasTextSource("## Styled coast", { ...DEFAULT_RICH_PRESENTATION, styleId: "section-heading", width: 80 });
  const content = `~~~\n## Fake heading\n~~~\n\n${heading}`;
  const headings = extractMarkdownHeadings(content, "chapter-1");
  assert.equal(headings.length, 1);
  assert.equal(headings[0].label, "Styled coast");
  assert.equal(headings[0].key, JSON.stringify([2, "Styled coast <!-- note-me:layout width=80 align=left style=section-heading -->", 1]));
  const resolved = resolveManuscriptDestination(content, { kind: "heading", key: headings[0].key });
  assert.equal(resolved.block.presentation.styleId, "section-heading");
  const book = { toc_enabled: true, toc_depth: 6, dedication: "", epigraph: "", copyright_text: "", acknowledgements: "", toc_include_front_matter: false, toc_include_back_matter: false };
  const section = chapter(1, content, { toc_heading_exclusions: [headings[0].key] });
  assert.equal(buildBookToc(book, [section]).filter((entry) => entry.source === "heading").length, 0);
  const preview = buildBookToc(book, [section], { includeExcludedHeadings: true }).find((entry) => entry.source === "heading");
  assert.equal(preview.included, false);
  assert.equal(preview.label, "Styled coast");
});

test("search destinations preserve exact match selection and re-resolve changed source", () => {
  const content = "coast first\n\ncoast second";
  const matches = findManuscriptMatches(content, "coast");
  const destination = { kind: "search", query: "coast", options: { wholeWord: true }, start: matches[1].start, source: content };
  assert.equal(resolveManuscriptDestination(content, destination).findIndex, 1);
  assert.equal(resolveManuscriptDestination(content, destination).stale, false);
  const changed = resolveManuscriptDestination(`New paragraph\n\n${content}`, destination);
  assert.equal(changed.findIndex, 0);
  assert.equal(changed.stale, true);
  assert.ok(changed.block);
  const removed = resolveManuscriptDestination("No more matches.", destination);
  assert.equal(removed.block, null);
  assert.equal(removed.stale, true);
  assert.equal(resolveManuscriptDestination(content, { kind: "title" }).block, null);
});

test("snippet edges preserve supplementary characters and literal replacement characters", () => {
  const content = "Start 😀coast😀 end $& <script>";
  const matches = findManuscriptMatches(content, "coast");
  const [excerpt] = manuscriptMatchExcerpts(content, matches, 1);
  assert.equal(excerpt.before, "…😀");
  assert.equal(excerpt.after, "😀…");
  assert.equal(excerpt.match, "coast");
  assert.deepEqual(manuscriptMatchExcerpts(content, [{ start: 1, end: 2, blockStart: 999 }]), [null]);
});
