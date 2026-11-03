const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BOOK_COVER_TEMPLATES,
  coverCss,
  coverIssueLine,
  coverMarkup,
  coverPageHtml,
  resolveCover,
} = require("./.compiled/src/lib/bookCover.js");
const { DEFAULT_BOOK_LAYOUT } = require("./.compiled/src/lib/bookLayout.js");

function coverBook(overrides = {}) {
  return {
    id: 1,
    title: "Field Notes",
    subtitle: "A slow-living special",
    author: "A. Editor",
    description: "Notes on attention, place, and the everyday.",
    genre: "Independent magazine",
    trim_size: "8.5x11",
    font_family: "serif",
    cover_color: "#7c2f24",
    ...overrides,
  };
}

function coverLayout(cover = {}, publication = {}) {
  return {
    ...DEFAULT_BOOK_LAYOUT,
    publication: { ...DEFAULT_BOOK_LAYOUT.publication, ...publication },
    cover: { ...DEFAULT_BOOK_LAYOUT.cover, ...cover },
  };
}

test("resolved cover inherits book metadata and issue language", () => {
  const book = coverBook();
  const layout = coverLayout({}, { volume: "02", issue: "04", season: "Summer", year: "2026" });
  const resolved = resolveCover(book, layout);
  assert.equal(resolved.masthead, "Field Notes");
  assert.equal(resolved.kicker, "Independent magazine");
  assert.equal(resolved.headline, "A slow-living special");
  assert.equal(resolved.standfirst, "Notes on attention, place, and the everyday.");
  assert.equal(resolved.issueLine, "Volume 02 · Issue 04 · Summer 2026");
  assert.equal(resolved.watermark, "04");
  assert.equal(resolved.textColor, "#fffaf3");
  assert.equal(resolved.accentColor, "#f2c6a0");
  assert.equal(coverIssueLine({ volume: "02", issue: "04", season: "", year: "" }), "Volume 02 · Issue 04");
});

test("light covers choose dark ink automatically and honour explicit colours", () => {
  const light = resolveCover(coverBook({ cover_color: "#fffaf3" }), coverLayout());
  assert.equal(light.textColor, "#211b16");
  const explicit = resolveCover(coverBook(), coverLayout({ textColor: "#ffcc00", accentColor: "#00aa88" }));
  assert.equal(explicit.textColor, "#ffcc00");
  assert.equal(explicit.accentColor, "#00aa88");
  const photo = resolveCover(coverBook({ cover_color: "#fffaf3" }), coverLayout({ image: "data:image/png;base64,AAAA" }));
  assert.equal(photo.textColor, "#fffaf3");
});

test("cover markup renders escaped copy, lines, barcode, and a custom image", () => {
  const layout = coverLayout({
    template: "type-led",
    masthead: "Field & Notes",
    kicker: "The attention issue",
    headline: "Slow <looking>",
    standfirst: "A quieter way to read the world.",
    issueLine: "Issue 04",
    coverLines: [
      { label: "Feature", text: "A case for slow looking" },
      { label: "", text: "Ten rooms, ten windows" },
    ],
    price: "$12",
    accentColor: "#f2c6a0",
    image: "data:image/png;base64,AAAA",
    alignment: "center",
  });
  const markup = coverMarkup(coverBook(), layout);
  assert.match(markup, /template-type-led/);
  assert.match(markup, /align-center/);
  assert.match(markup, /Field &amp; Notes/);
  assert.match(markup, /Slow &lt;looking&gt;/);
  assert.match(markup, /A case for slow looking/);
  assert.match(markup, /Ten rooms, ten windows/);
  assert.match(markup, /class="book-cover-bars"/);
  assert.match(markup, /\$12/);
  assert.match(markup, /background-image:url\('data:image\/png;base64,AAAA'\)/);
  assert.doesNotMatch(markup, /<looking>/);
});

test("cover page helpers and CSS expose the printable cover contract", () => {
  const page = coverPageHtml(coverBook(), coverLayout({ enabled: true }));
  assert.match(page, /^<section class="book-cover-page">/);
  assert.match(page, /class="book-cover-art/);
  const css = coverCss();
  assert.match(css, /\.book-cover-art/);
  assert.match(css, /\.book-cover-barcode/);
  assert.match(css, /@page book-cover/);
  assert.match(css, /template-type-led/);
  assert.ok(BOOK_COVER_TEMPLATES.length >= 4);
});
