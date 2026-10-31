const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_BOOK_LAYOUT,
  pageNumberForSection,
  pageNumberText,
  parseBookLayout,
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
test("missing paragraph style libraries fall back to the built-in presets", () => {
  const parsed = parseBookLayout("{}");
  assert.ok(parsed.paragraphStyles.length >= 6);
  assert.ok(parsed.paragraphStyles.some((preset) => preset.id === "body-classic"));
  assert.ok(parsed.paragraphStyles.every((preset) => preset.style.ruleAbove && preset.style.border && preset.style.bullets));
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
