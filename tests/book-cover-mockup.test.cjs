const test = require("node:test");
const assert = require("node:assert/strict");
const { coverMockupFilename, coverMockupLayout } = require("./.compiled/src/lib/bookCoverMockup.js");
const { coverMetrics } = require("./.compiled/src/lib/bookCoverDoc.js");

const metrics = coverMetrics("6x9", { pageCount: 320, paperStock: "cream-60", spineWidthOverride: 0, bleed: 0.125 });

test("mockup layouts keep the whole book inside every marketing format", () => {
  for (const [width, height] of [[1600, 1600], [1920, 1080], [1080, 1920]]) {
    const layout = coverMockupLayout(metrics, width, height, true);
    assert.ok(layout.scale > 0);
    assert.ok(layout.bookWidth > 0);
    assert.ok(layout.bookHeight > 0);
    assert.ok(layout.left >= 0, `${width}x${height} left`);
    assert.ok(layout.top >= 0, `${width}x${height} top`);
    assert.ok(layout.left + layout.bookWidth <= width + 0.01, `${width}x${height} right`);
    assert.ok(layout.top + layout.bookHeight <= height + 0.01, `${width}x${height} bottom`);
  }
});

test("mockup layout gives the book more room without a caption", () => {
  const captioned = coverMockupLayout(metrics, 1600, 1600, true);
  const uncaptioned = coverMockupLayout(metrics, 1600, 1600, false);
  assert.ok(uncaptioned.bookHeight > captioned.bookHeight);
  assert.ok(uncaptioned.bookWidth > captioned.bookWidth);
});

test("mockup filenames carry size and transparency", () => {
  assert.equal(
    coverMockupFilename({ title: "The Quiet Hour" }, { width: 1600, height: 1600, background: "studio" }),
    "the-quiet-hour-cover-mockup-1600x1600.png",
  );
  assert.equal(
    coverMockupFilename({ title: "The Quiet Hour" }, { width: 1080, height: 1920, background: "transparent" }),
    "the-quiet-hour-cover-mockup-1080x1920-transparent.png",
  );
  assert.equal(
    coverMockupFilename({ title: "The Quiet Hour" }, { width: 1600, height: 1600, background: "studio", format: "hardcover" }),
    "the-quiet-hour-cover-mockup-1600x1600-hardcover.png",
  );
});
