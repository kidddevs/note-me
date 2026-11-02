const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_BOOK_LAYOUT,
  EDITORIAL_PARAGRAPH_STYLES,
  hasEditorialStyles,
  mergeEditorialStyles,
  pageNumberForSection,
  pageNumberText,
  parseBookLayout,
  layoutTokenText,
} = require("./.compiled/src/lib/bookLayout.js");

test("invalid layouts normalize to safe publishing defaults", () => {
  assert.deepEqual(parseBookLayout("not-json"), DEFAULT_BOOK_LAYOUT);
  const parsed = parseBookLayout(JSON.stringify({
    pageNumbering: { enabled: true, style: "invalid", start: -4, startSection: "invalid" },
    typography: { paragraph: { fontSize: 400, lineHeight: 0.1, nestedWords: 99 } },
  }));
  assert.equal(parsed.pageNumbering.style, "arabic");
  assert.equal(parsed.pageNumbering.start, 1);
  assert.equal(parsed.pageNumbering.startSection, "story");
  assert.equal(parsed.typography.paragraph.fontSize, 96);
  assert.equal(parsed.typography.paragraph.lineHeight, 0.8);
  assert.equal(parsed.typography.paragraph.nestedWords, 12);
});

test("page colors default to white and parse independently from the cover", () => {
  assert.equal(parseBookLayout("{}").pageColor, "#ffffff");
  assert.equal(parseBookLayout("{}").accentColor, "#a56b3e");
  const parsed = parseBookLayout(JSON.stringify({ pageColor: "#22201d", accentColor: "#6f7f6d" }));
  assert.equal(parsed.pageColor, "#22201d");
  assert.equal(parsed.accentColor, "#6f7f6d");
});

test("paper patterns normalize and clamp to useful journal settings", () => {
  const defaults = parseBookLayout("{}");
  assert.equal(defaults.pagePattern, "blank");
  assert.equal(defaults.pagePatternColor, "#c9c0b4");
  assert.equal(defaults.pagePatternSpacing, 0.28);
  const parsed = parseBookLayout(JSON.stringify({ pagePattern: "dotted", pagePatternColor: "#6f7f6d", pagePatternSpacing: 0.12 }));
  assert.equal(parsed.pagePattern, "dotted");
  assert.equal(parsed.pagePatternColor, "#6f7f6d");
  assert.equal(parsed.pagePatternSpacing, 0.15);
  assert.equal(parseBookLayout(JSON.stringify({ pagePattern: "invalid" })).pagePattern, "blank");
  assert.equal(parseBookLayout(JSON.stringify({ pagePatternSpacing: 9 })).pagePatternSpacing, 0.6);
  assert.equal(parseBookLayout("{}").freeMargins, false);
  assert.equal(parseBookLayout(JSON.stringify({ freeMargins: true })).freeMargins, true);
});

test("page margins normalize per edge and fall back to the book margin", () => {
  const parsed = parseBookLayout(JSON.stringify({ pageMargins: { top: 1.5, right: -1, bottom: 0.75, left: 9 } }));
  assert.deepEqual(parsed.pageMargins, { top: 1.5, right: 0.2, bottom: 0.75, left: 3 });
  const fallback = parseBookLayout(undefined, undefined, { top: 0.75, right: 0.8, bottom: 0.9, left: 1 });
  assert.deepEqual(fallback.pageMargins, { top: 0.75, right: 0.8, bottom: 0.9, left: 1 });
});

test("paragraph style presets preserve advanced publication controls", () => {
  const parsed = parseBookLayout(JSON.stringify({
    paragraphStyles: [{
      id: "magazine-feature",
      name: "Magazine feature",
      style: {
        fontFamily: "sans",
        fontSize: 18,
        color: "accent",
        underline: true,
        strikethrough: true,
        textCase: "small-caps",
        hyphenation: true,
        columns: 3,
        columnGap: 1.5,
        ruleAbove: { enabled: true, width: 2, color: "#111111", style: "dashed", offset: 0.4 },
        ruleBelow: { enabled: true, width: 1, color: "accent", style: "solid", offset: 0.2 },
        border: { enabled: true, width: 1, color: "accent", style: "solid", padding: 1, radius: 8 },
        shading: { enabled: true, color: "accent" },
        bullets: { enabled: true, type: "number", marker: "1.", indent: 2 },
        grep: { enabled: true, pattern: "\\b[A-Z]{2,}\\b", style: "accent", color: "#111111" },
        tabs: [{ position: 1.5, align: "left" }],
      },
    }],
  }));
  assert.equal(parsed.paragraphStyles.length, 1);
  const style = parsed.paragraphStyles[0];
  assert.equal(style.id, "magazine-feature");
  assert.equal(style.name, "Magazine feature");
  assert.equal(style.style.fontSize, 18);
  assert.equal(style.style.color, "accent");
  assert.equal(style.style.textCase, "small-caps");
  assert.equal(style.style.columns, 3);
  assert.equal(style.style.columnGap, 1.5);
  assert.equal(style.style.ruleAbove.style, "dashed");
  assert.equal(style.style.border.radius, 8);
  assert.equal(style.style.bullets.type, "number");
  assert.equal(style.style.tabs[0].position, 1.5);
  assert.ok(parsed.paragraphStyles.some((preset) => preset.id !== "magazine-feature") === false);
});
test("magazine typography controls normalize for print and EPUB", () => {
  const parsed = parseBookLayout(JSON.stringify({
    baselineGrid: { enabled: true, spacing: 0.12, color: "#6f7f6d" },
    typography: {
      paragraph: {
        keepLines: true,
        breakBefore: true,
        widows: 3,
        orphans: 4,
        ligatures: "none",
        figureStyle: "oldstyle",
        hangingPunctuation: true,
        lastLineAlign: "left",
      },
    },
  }));
  assert.equal(parsed.baselineGrid.enabled, true);
  assert.equal(parsed.baselineGrid.spacing, 0.12);
  assert.equal(parsed.baselineGrid.color, "#6f7f6d");
  assert.equal(parsed.typography.paragraph.keepLines, true);
  assert.equal(parsed.typography.paragraph.breakBefore, true);
  assert.equal(parsed.typography.paragraph.widows, 3);
  assert.equal(parsed.typography.paragraph.orphans, 4);
  assert.equal(parsed.typography.paragraph.ligatures, "none");
  assert.equal(parsed.typography.paragraph.figureStyle, "oldstyle");
  assert.equal(parsed.typography.paragraph.hangingPunctuation, true);
  assert.equal(parsed.typography.paragraph.lastLineAlign, "left");

  const issue = parseBookLayout(JSON.stringify({ publication: { volume: "02", issue: "04", season: "Summer", year: "2026" } }));
  assert.deepEqual(issue.publication, { volume: "02", issue: "04", season: "Summer", year: "2026" });

  const fallback = parseBookLayout(JSON.stringify({ baselineGrid: { spacing: 9 }, typography: { paragraph: { widows: 99, ligatures: "invalid" } } }));
  assert.equal(fallback.baselineGrid.spacing, 0.6);
  assert.equal(fallback.typography.paragraph.widows, 5);
  assert.equal(fallback.typography.paragraph.ligatures, "normal");
});

test("missing paragraph style libraries fall back to the built-in presets", () => {
  const parsed = parseBookLayout("{}");
  assert.ok(parsed.paragraphStyles.length >= 6);
  assert.ok(parsed.paragraphStyles.some((preset) => preset.id === "body-classic"));
  assert.ok(parsed.paragraphStyles.every((preset) => preset.style.ruleAbove && preset.style.border && preset.style.bullets));
});

test("the editorial style kit merges once and is idempotent", () => {
  const once = mergeEditorialStyles(DEFAULT_BOOK_LAYOUT.paragraphStyles);
  assert.equal(once.length, DEFAULT_BOOK_LAYOUT.paragraphStyles.length + EDITORIAL_PARAGRAPH_STYLES.length);
  assert.equal(hasEditorialStyles(once), true);
  assert.equal(mergeEditorialStyles(once).length, once.length);
  const kicker = once.find((style) => style.id === "editorial-kicker");
  assert.equal(kicker.style.textCase, "uppercase");
  assert.equal(kicker.style.color, "accent");
  assert.equal(kicker.style.fontFamily, "sans");
});

test("issue tokens resolve in running heads and footers", () => {
  const book = { title: "Field Notes", author: "A. Editor" };
  const publication = { volume: "02", issue: "04", season: "Summer", year: "2026" };
  const resolved = layoutTokenText("{{issueLine}} · {{season}} {{year}} · {{page}}", book, "Feature", "12", publication);
  assert.equal(resolved, "Volume 02 · Issue 04 · Summer 2026 · 12");
  assert.equal(layoutTokenText("{{volume}}/{{issue}}", book, "", "", publication), "02/04");
});

test("page numbering honors start bands, overrides, and roman/custom styles", () => {
  const layout = {
    ...DEFAULT_BOOK_LAYOUT,
    pageNumbering: {
      ...DEFAULT_BOOK_LAYOUT.pageNumbering,
      enabled: true,
      start: 3,
      startSection: "story",
      rules: {
        "opening:9": { enabled: true, style: "roman-lower", start: 1, customFormat: "{n}" },
        "story:12": { enabled: true, style: "custom", start: 7, customFormat: "Leaf {n}" },
      },
    },
  };
  assert.equal(pageNumberForSection(layout, "opening", "opening", 0), null);
  assert.equal(pageNumberForSection(layout, "opening:9", "opening", 1), "ii");
  assert.equal(pageNumberForSection(layout, "story", "story", 2), "5");
  assert.equal(pageNumberForSection(layout, "story:12", "story", 0), "Leaf 7");
  assert.equal(pageNumberText(14, "roman-upper", "{n}"), "XIV");
});
