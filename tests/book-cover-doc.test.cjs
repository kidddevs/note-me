const test = require("node:test");
const assert = require("node:assert/strict");
const {
  barcodeSvgMarkup,
  COVER_IMAGE_PRESETS,
  coverDocMarkup,
  coverImageFilterCss,
  coverImageMaskCss,
  imageLayer,
  coverMetrics,
  createCoverDocument,
  ean13Bits,
  estimateManuscriptPages,
  isbn13CheckDigit,
  normalizeIsbn13,
  parseCoverDocument,
  reflowSpineLayers,
  spineWidthForPages,
  spineWidthMillimetres,
} = require("./.compiled/src/lib/bookCoverDoc.js");
const { DEFAULT_BOOK_LAYOUT } = require("./.compiled/src/lib/bookLayout.js");

function book(overrides = {}) {
  return {
    id: 1,
    title: "The Quiet Hour",
    subtitle: "A slow-living special",
    author: "A. Editor",
    description: "Notes on attention, place, and the everyday.",
    genre: "Literary nonfiction",
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

function cover(overrides = {}) {
  return {
    ...DEFAULT_BOOK_LAYOUT.cover,
    enabled: true,
    pageCount: 320,
    isbn: "978-0-306-40615-7",
    ...overrides,
  };
}

test("spine width follows page count and paper stock", () => {
  assert.equal(spineWidthForPages(320, "cream-60"), 0.8);
  assert.equal(spineWidthForPages(320, "white-60"), 0.721);
  assert.equal(spineWidthForPages(10, "cream-60"), 0.0625);
  assert.equal(spineWidthForPages(320, "cream-60", 1.05), 1.05);
  assert.equal(spineWidthMillimetres(0.8), 20.3);
});

test("wrap metrics lay out back, spine, front, and bleed", () => {
  const metrics = coverMetrics("6x9", cover());
  assert.equal(metrics.trimWidth, 6);
  assert.equal(metrics.trimHeight, 9);
  assert.equal(metrics.spineWidth, 0.8);
  assert.equal(metrics.fullWidth, 13.05);
  assert.equal(metrics.fullHeight, 9.25);
  assert.deepEqual(metrics.panelOrigins.front, { x: 6.925, y: 0.125 });
  assert.deepEqual(metrics.panelOrigins.spine, { x: 6.125, y: 0.125 });
});

test("ISBN-10 and ISBN-13 inputs normalize to a scannable EAN-13 pattern", () => {
  assert.equal(isbn13CheckDigit("978030640615"), 7);
  assert.equal(normalizeIsbn13("978-0-306-40615-7"), "9780306406157");
  assert.equal(normalizeIsbn13("0-306-40615-2"), "9780306406157");
  assert.equal(ean13Bits("9780306406157").length, 95);
  assert.match(barcodeSvgMarkup("9780306406157"), /<rect/);
  assert.match(barcodeSvgMarkup(""), /opacity="\.24"/);
});

test("layered cover documents normalize safely", () => {
  const parsed = parseCoverDocument(null);
  assert.deepEqual(parsed.layers, []);
  assert.equal(parsed.background.type, "solid");
  const normalized = parseCoverDocument({
    templateId: "atelier",
    background: { type: "gradient", gradient: { type: "radial", angle: 90, stops: [{ color: "#fff", position: 0 }, { color: "#000", position: 1 }] } },
    layers: [
      { type: "text", id: "title", panel: "front", x: -20, y: 2, width: 99, height: 0, fontSize: 400, text: "Hi" },
      { type: "image", id: "photo", panel: "back", src: "data:image/png;base64,AAAA", opacity: 8 },
      { type: "barcode", id: "isbn", panel: "back", width: 2, height: 1 },
      { type: "unknown", id: "ignored" },
    ],
  });
  assert.equal(normalized.templateId, "atelier");
  assert.equal(normalized.background.gradient.type, "radial");
  assert.equal(normalized.layers.length, 4);
  const title = normalized.layers[0];
  assert.equal(title.type, "text");
  assert.equal(title.x, -20);
  assert.equal(title.width, 60);
  assert.equal(title.height, 0.02);
  assert.equal(title.fontSize, 240);
  const photo = normalized.layers[1];
  assert.equal(photo.opacity, 1);
  assert.equal(normalized.layers[2].type, "barcode");
  assert.equal(normalized.layers[3].type, "text");
});

test("templates create front, spine, back, and barcode layers", () => {
  const seeded = createCoverDocument("atelier", book(), cover());
  assert.equal(seeded.templateId, "atelier");
  assert.ok(seeded.layers.some((layer) => layer.panel === "front" && layer.type === "text"));
  assert.ok(seeded.layers.some((layer) => layer.panel === "spine" && layer.type === "text"));
  assert.ok(seeded.layers.some((layer) => layer.panel === "back" && layer.type === "text"));
  assert.ok(seeded.layers.some((layer) => layer.type === "barcode" && layer.panel === "back"));
  const markup = coverDocMarkup(book(), { ...cover(), doc: seeded }, "front");
  assert.match(markup, /The Quiet Hour/);
  assert.match(markup, /cover-doc-panel-front/);
  const back = coverDocMarkup(book(), { ...cover(), doc: seeded }, "back");
  assert.match(back, /Notes on attention, place, and the everyday\./);
  assert.match(back, /978-0-306-40615-7/);
  assert.match(back, /cover-barcode-svg/);
});

test("spine layers stay centred when the spine changes", () => {
  const doc = createCoverDocument("minimal", book(), cover());
  const before = coverMetrics("6x9", cover());
  const after = coverMetrics("6x9", cover({ pageCount: 420 }));
  const next = reflowSpineLayers(doc, before.spineWidth, after.spineWidth);
  const title = next.layers.find((layer) => layer.id === "spine-title");
  assert.ok(title);
  const centre = title.x + title.width / 2;
  assert.ok(Math.abs(centre - after.spineWidth / 2) < 0.01);
});

test("manuscript page estimates scale with word count", () => {
  const chapters = [
    { id: 1, book_id: 1, chapter_kind: "chapter", title: "One", content: "word ".repeat(10000), position: 1, toc_include: true, toc_heading_exclusions: [], layout_json: "", created_at: "", updated_at: "" },
  ];
  const pages = estimateManuscriptPages(book(), chapters);
  assert.ok(pages > 20 && pages < 200);
  assert.equal(estimateManuscriptPages(book(), []), 0);
});

test("layered covers travel into HTML exports as the front panel", () => {
  const { bookHtml } = require("./.compiled/src/lib/bookPublishing.js");
  const baseCover = cover();
  const doc = createCoverDocument("atelier", book(), baseCover);
  const layoutJson = JSON.stringify({ cover: { ...baseCover, doc } });
  const htmlBook = book({ layout_json: layoutJson });
  const chapters = [
    { id: 1, book_id: 1, chapter_kind: "title_page", title: "The Quiet Hour", content: "By A. Editor", position: 0, toc_include: false, toc_heading_exclusions: [], layout_json: "", created_at: "", updated_at: "" },
  ];
  const html = bookHtml(htmlBook, chapters);
  assert.match(html, /class="cover-doc-page"/);
  assert.match(html, /cover-doc-panel-front/);
  assert.match(html, /The Quiet Hour/);
  assert.match(html, /@page book-cover/);
});

test("artwork layers render the shared book-graphic library", () => {
  const doc = parseCoverDocument({
    layers: [{
      id: "fleuron",
      type: "artwork",
      name: "Fleuron",
      panel: "front",
      x: 0.5,
      y: 0.5,
      width: 1.4,
      height: 0.7,
      graphicId: "fleuron",
      color: "#a56b3e",
    }],
  });
  assert.equal(doc.layers[0].type, "artwork");
  assert.equal(doc.layers[0].graphicId, "fleuron");
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /cover-doc-artwork/);
  assert.match(markup, /data:image\/svg\+xml;base64,/);
});


test("image layers normalise the tone lab and crop controls", () => {
  const doc = parseCoverDocument({
    layers: [{
      id: "photo",
      type: "image",
      name: "Photo",
      panel: "front",
      x: 0,
      y: 0,
      width: 3,
      height: 4,
      src: "data:image/png;base64,aaa",
      contrast: 145,
      saturation: 80,
      hue: 12,
      blur: 0.5,
      tint: "#ff0000",
      tintStrength: 2,
      mask: "circle",
      focusX: 2,
      focusY: -1,
      flipX: true,
    }],
  });
  const layer = doc.layers[0];
  assert.equal(layer.contrast, 145);
  assert.equal(layer.saturation, 80);
  assert.equal(layer.hue, 12);
  assert.equal(layer.blur, 0.08);
  assert.equal(layer.tint, "#ff0000");
  assert.equal(layer.tintStrength, 1);
  assert.equal(layer.mask, "circle");
  assert.equal(layer.focusX, 1);
  assert.equal(layer.focusY, 0);
  assert.equal(layer.flipX, true);

  const legacy = parseCoverDocument({
    layers: [{ id: "old", type: "image", name: "Old", panel: "front", x: 0, y: 0, width: 2, height: 3, src: "data:," }],
  });
  assert.equal(legacy.layers[0].contrast, 100);
  assert.equal(legacy.layers[0].saturation, 100);
  assert.equal(legacy.layers[0].hue, 0);
  assert.equal(legacy.layers[0].blur, 0);
  assert.equal(legacy.layers[0].mask, "none");
  assert.equal(legacy.layers[0].focusX, 0.5);
});

test("image lab markup carries filters, masks, focal point, tint, and flips", () => {
  const layer = imageLayer({
    id: "photo",
    name: "Photo",
    panel: "front",
    x: 0,
    y: 0,
    width: 3,
    height: 4,
    src: "data:image/png;base64,aaa",
    grayscale: true,
    contrast: 125,
    brightness: 108,
    saturation: 80,
    hue: 12,
    blur: 0.02,
    mask: "diamond",
    focusX: 0.35,
    focusY: 0.7,
    tint: "#c96b3b",
    tintStrength: 0.55,
    flipX: true,
  });
  const doc = parseCoverDocument({ layers: [layer] });
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /object-position:35% 70%/);
  assert.match(markup, /filter:grayscale\(1\) brightness\(108%\) contrast\(125%\) saturate\(80%\) hue-rotate\(12deg\) blur\(1\.92px\)/);
  assert.match(markup, /clip-path:polygon\(50% 0/);
  assert.match(markup, /cover-doc-image-tint/);
  assert.match(markup, /scale\(-1,1\)/);
  assert.match(coverImageFilterCss({ grayscale: false, sepia: false, brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0.02 }), /blur\(1\.92px\)/);
  assert.equal(coverImageMaskCss("arch"), "border-radius:50% 50% 0 0 / 34% 34% 0 0;");
  assert.ok(COVER_IMAGE_PRESETS.length >= 6);
  assert.ok(COVER_IMAGE_PRESETS.find((preset) => preset.id === "duotone").patch.tintStrength > 0);
});

test("mockup panels render at their real trim dimensions", () => {
  const baseCover = { ...cover(), pageCount: 320, paperStock: "cream-60", spineWidthOverride: 0 };
  const metrics = coverMetrics("6x9", baseCover);
  const doc = createCoverDocument("atelier", book(), baseCover);
  const layout = { ...baseCover, doc };
  const front = coverDocMarkup(book(), layout, "front");
  const back = coverDocMarkup(book(), layout, "back");
  const spine = coverDocMarkup(book(), layout, "spine");
  assert.match(front, /width:6in;height:9in/);
  assert.match(back, /width:6in;height:9in/);
  assert.match(spine, new RegExp(`width:${metrics.spineWidth}in;height:9in`));
  assert.match(front, /data-panel="front"/);
  assert.match(back, /data-panel="back"/);
  assert.match(spine, /data-panel="spine"/);
});
