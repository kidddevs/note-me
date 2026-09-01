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
