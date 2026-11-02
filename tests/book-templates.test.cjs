const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BOOK_TEMPLATES,
  bookTemplate,
  bookTemplateInput,
  bookTemplateLayout,
} = require("./.compiled/src/lib/bookTemplates.js");
const { CHAPTER_KIND_OPTIONS, chapterIsOpeningPage } = require("./.compiled/src/lib/chapterKinds.js");
const { parseBookLayout } = require("./.compiled/src/lib/bookLayout.js");
const { orderBookChapters } = require("./.compiled/src/lib/bookToc.js");
const { bookHtml } = require("./.compiled/src/lib/bookPublishing.js");

function bookFromInput(input) {
  return {
    id: 1,
    title: input.title,
    subtitle: input.subtitle,
    author: input.author,
    description: input.description,
    genre: input.genre,
    status: input.status,
    trim_size: input.trimSize,
    font_family: input.fontFamily,
    font_size: input.fontSize,
    line_height: input.lineHeight,
    paragraph_spacing: input.paragraphSpacing,
    margin: input.margin,
    word_goal: input.wordGoal,
    cover_color: input.coverColor,
    dedication: input.dedication,
    epigraph: input.epigraph,
    copyright_text: input.copyrightText,
    acknowledgements: input.acknowledgements,
    toc_enabled: input.tocEnabled,
    toc_title: input.tocTitle,
    toc_depth: input.tocDepth,
    toc_include_front_matter: input.tocIncludeFrontMatter,
    toc_include_back_matter: input.tocIncludeBackMatter,
    layout_json: input.layoutJson,
    created_at: "",
    updated_at: "",
  };
}

function chaptersForTemplate(template) {
  return template.chapters.map((chapter, index) => ({
    id: index + 1,
    book_id: 1,
    chapter_kind: chapter.kind,
    title: chapter.title,
    content: chapter.content,
    position: index,
    toc_include: true,
    toc_heading_exclusions: [],
    created_at: "",
    updated_at: "",
  }));
}

test("every starter template uses the shared section vocabulary", () => {
  const validKinds = new Set(CHAPTER_KIND_OPTIONS.map((option) => option.value));
  assert.ok(BOOK_TEMPLATES.length >= 6);
  for (const template of BOOK_TEMPLATES) {
    assert.ok(template.chapters.length > 0, `${template.id} should seed at least one section`);
    for (const chapter of template.chapters) {
      assert.ok(validKinds.has(chapter.kind), `${template.id} uses an unknown section kind: ${chapter.kind}`);
      assert.ok(chapter.title.trim().length > 0, `${template.id} chapter should have a title`);
    }
  }
});

test("the magazine template starts with a cover, masthead, editorial and feature", () => {
  const magazine = bookTemplate("magazine");
  const kinds = magazine.chapters.map((chapter) => chapter.kind);
  assert.deepEqual(kinds.slice(0, 3), ["cover", "masthead", "editorial"]);
  assert.ok(kinds.includes("feature"));
  assert.ok(kinds.includes("department"));
  assert.ok(kinds.includes("colophon"));
  assert.equal(magazine.trimSize, "8.5x11");
  assert.equal(magazine.presetId, "magazine");
});

test("editorial presets carry magazine paragraph styles into the serialized layout", () => {
  const magazine = bookTemplate("magazine");
  const input = bookTemplateInput(magazine, "Field Notes");
  assert.equal(input.title, "Field Notes");
  assert.equal(input.trimSize, "8.5x11");
  assert.equal(input.tocTitle, "In this issue");
  const layout = parseBookLayout(input.layoutJson);
  const styleIds = new Set(layout.paragraphStyles.map((style) => style.id));
  for (const id of ["editorial-kicker", "editorial-standfirst", "editorial-byline", "editorial-folio", "editorial-cover-line"]) {
    assert.ok(styleIds.has(id), `magazine template should include ${id}`);
  }
  assert.equal(layout.typography.paragraph.fontFamily, "serif");
  assert.equal(layout.typography.paragraph.fontSize, 10.5);
  assert.equal(layout.accentColor, "#b04a31");
  assert.equal(layout.pageMargins.top, 0.55);
});

test("opening pages sort before story and closing sections in every template", () => {
  for (const template of BOOK_TEMPLATES) {
    const chapters = template.chapters.map((chapter, index) => ({
      id: index + 1,
      book_id: 1,
      chapter_kind: chapter.kind,
      title: chapter.title,
      content: chapter.content,
      position: index,
      toc_include: true,
      toc_heading_exclusions: [],
      created_at: "",
      updated_at: "",
    }));
    const ordered = orderBookChapters(chapters);
    const groups = ordered.map((chapter) => CHAPTER_KIND_OPTIONS.find((option) => option.value === chapter.chapter_kind).group);
    const rank = { front: 0, story: 1, back: 2 };
    const sorted = groups.every((group, index) => index === 0 || rank[groups[index - 1]] <= rank[group]);
    assert.ok(sorted, `${template.id} should sort front, story, back`);
  }
});

test("covers behave like title pages for opening-page detection", () => {
  assert.equal(chapterIsOpeningPage("cover"), true);
  assert.equal(chapterIsOpeningPage("title_page"), true);
  assert.equal(chapterIsOpeningPage("feature"), false);
  assert.ok(bookTemplateLayout(bookTemplate("photo-book")).typography);
});

test("a magazine template exports a cover-led issue with editorial CSS", () => {
  const template = bookTemplate("magazine");
  const input = bookTemplateInput(template, "Field Notes");
  const html = bookHtml(bookFromInput(input), chaptersForTemplate(template));
  assert.match(html, /@page \{ size: 8\.5in 11in/);
  assert.match(html, /The Slow Issue/);
  assert.match(html, /Masthead/);
  assert.match(html, /book-style-editorial-kicker/);
  assert.match(html, /--document-accent: #b04a31/);
  assert.match(html, /class="title-page"/);
});
