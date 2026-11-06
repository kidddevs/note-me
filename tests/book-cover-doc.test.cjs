const test = require("node:test");
const assert = require("node:assert/strict");
const {
  barcodeSvgMarkup,
  COVER_FONTS,
  COVER_IMAGE_PRESETS,
  COVER_TEMPLATE_PRESETS,
  coverDocMarkup,
  coverFillCss,
  coverFontCss,
  coverImageFilterCss,
  COVER_GRADIENT_PRESETS,
  coverGroupLocked,
  coverLayerClipCss,
  coverLayerClipMatrix,
  coverLayerFadeCss,
  coverImageMaskCss,
  coverImageOverflow,
  coverPatternDataUrl,
  panCoverImageFocus,
  cloneCoverLayers,
  coverLayerLocked,
  coverLayerVisible,
  coverShapePath,
  coverFill,
  imageLayer,
  coverMetrics,
  createCoverDocument,
  ean13Bits,
  emptyCoverDocument,
  estimateManuscriptPages,
  isbn13CheckDigit,
  normalizeIsbn13,
  parseCoverDocument,
  reflowSpineLayers,
  reorderCoverGroup,
  reverseCoverGradient,
  shapeLayer,
  spineWidthForPages,
  spineWidthMillimetres,
  textLayer,
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


test("layer groups persist, sanitise broken membership, and hide children", () => {
  const doc = parseCoverDocument({
    groups: [{ id: "g1", name: "Front type", visible: false, locked: true, collapsed: false }],
    layers: [
      { id: "grouped", type: "text", name: "Grouped", panel: "front", x: 0.5, y: 0.5, width: 2, height: 1, text: "Hidden by group", groupId: "g1" },
      { id: "orphan", type: "text", name: "Orphan", panel: "front", x: 3, y: 0.5, width: 2, height: 1, text: "Visible", groupId: "missing" },
    ],
  });
  assert.equal(doc.groups.length, 1);
  assert.equal(doc.groups[0].name, "Front type");
  assert.equal(doc.layers[0].groupId, "g1");
  assert.equal(doc.layers[1].groupId, null);
  assert.equal(coverLayerVisible(doc, doc.layers[0]), false);
  assert.equal(coverLayerLocked(doc, doc.layers[0]), true);
  assert.equal(coverLayerVisible(doc, doc.layers[1]), true);
  assert.equal(coverLayerLocked(doc, doc.layers[1]), false);

  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.doesNotMatch(markup, /Hidden by group/);
  assert.match(markup, /Visible/);
});

test("new cover documents start with an empty group list", () => {
  assert.deepEqual(emptyCoverDocument().groups, []);
  assert.deepEqual(createCoverDocument("atelier", book(), cover()).groups, []);
});


test("cloning layers creates fresh ids, offsets, and group remapping", () => {
  const source = [
    textLayer({ id: "a", name: "Title", panel: "front", x: 1, y: 2, width: 3, height: 1, text: "Hello" }),
    shapeLayer({ id: "b", name: "Block", panel: "front", x: 2, y: 3, width: 1, height: 1, shape: "rectangle", fill: coverFill("#123456") }),
  ];
  const clones = cloneCoverLayers(source, { offsetX: 0.2, offsetY: 0.3, stagger: 0.05, groupId: "group-1" });
  assert.equal(clones.length, 2);
  assert.notEqual(clones[0].id, source[0].id);
  assert.notEqual(clones[1].id, source[1].id);
  assert.match(clones[0].name, /copy$/);
  assert.equal(clones[0].x, 1.2);
  assert.equal(clones[0].y, 2.3);
  assert.equal(clones[1].x, 2.25);
  assert.equal(clones[1].y, 3.35);
  assert.equal(clones[0].groupId, "group-1");
  assert.equal(clones[1].groupId, "group-1");
  assert.notEqual(clones[1].fill, source[1].fill);
  clones[1].fill.color = "#000000";
  assert.equal(source[1].fill.color, "#123456");
});


test("curved text persists and renders as an SVG textPath", () => {
  const doc = parseCoverDocument({
    layers: [{
      id: "arc",
      type: "text",
      name: "Curved title",
      panel: "front",
      x: 0.5,
      y: 0.5,
      width: 4,
      height: 2,
      text: "Curved Title",
      fontSize: 42,
      curve: 55,
    }],
  });
  assert.equal(doc.layers[0].curve, 55);
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /cover-doc-curved-text/);
  assert.match(markup, /<textPath/);
  assert.match(markup, /Curved Title/);
  assert.doesNotMatch(markup, /cover-doc-text/);
});

test("curved text clamps and the font library includes editorial faces", () => {
  const high = parseCoverDocument({ layers: [{ id: "a", type: "text", name: "A", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "A", curve: 999 }] });
  const low = parseCoverDocument({ layers: [{ id: "b", type: "text", name: "B", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "B", curve: -999 }] });
  assert.equal(high.layers[0].curve, 100);
  assert.equal(low.layers[0].curve, -100);
  for (const id of ["baskerville", "garamond", "avenir", "futura", "optima", "copperplate", "typewriter", "hoefler", "bodoni", "gill", "bradley"]) {
    assert.ok(COVER_FONTS.some((font) => font.id === id), id);
  }
  assert.ok(COVER_FONTS.length >= 23);
});

test("cover documents persist a deduplicated palette and expanded blend modes", () => {
  const doc = parseCoverDocument({
    palette: ["#FF0000", "#ff0000", "not-a-colour", "#00FF00", "#00ff00"],
    layers: [{ id: "blend", type: "text", name: "Blend", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "A", blendMode: "color-dodge" }],
  });
  assert.deepEqual(doc.palette, ["#ff0000", "#00ff00"]);
  assert.equal(doc.layers[0].blendMode, "color-dodge");
  const invalid = parseCoverDocument({ layers: [{ id: "b", type: "text", name: "B", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "B", blendMode: "not-real" }] });
  assert.equal(invalid.layers[0].blendMode, "normal");
  assert.deepEqual(emptyCoverDocument().palette, []);
});

test("layer shadow and glow survive parsing and render into markup", () => {
  const doc = parseCoverDocument({
    layers: [{
      id: "effect",
      type: "text",
      name: "Effect",
      panel: "front",
      x: 0.5,
      y: 0.5,
      width: 3,
      height: 1,
      text: "Shadow",
      shadow: { enabled: true, color: "#000000", blur: 0.2, offsetX: 0.1, offsetY: 0.12, opacity: 0.5 },
      glow: { enabled: true, color: "#c9a227", blur: 0.3, opacity: 0.4 },
    }],
  });
  const layer = doc.layers[0];
  assert.equal(layer.shadow.enabled, true);
  assert.equal(layer.shadow.blur, 0.2);
  assert.equal(layer.glow.enabled, true);
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /filter:drop-shadow\(0\.1in 0\.12in 0\.2in rgba\(0, 0, 0, 0\.5\)\)/);
  assert.match(markup, /drop-shadow\(0 0 0\.3in rgba\(201, 162, 39, 0\.4\)\)/);

  const legacy = parseCoverDocument({ layers: [{ id: "old", type: "text", name: "Old", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "Old" }] });
  assert.equal(legacy.layers[0].shadow.enabled, false);
  assert.equal(legacy.layers[0].glow.enabled, false);
  assert.equal(legacy.layers[0].shadow.blur, 0.16);
});


test("pattern fills persist through CSS, markup, and SVG shapes", () => {
  const pattern = { type: "stripes", color: "#a56b3e", background: "#f5efe4", scale: 0.4, angle: 30 };
  const fill = { ...coverFill("#112233"), type: "pattern", pattern };
  const doc = parseCoverDocument({
    background: fill,
    layers: [shapeLayer({ id: "shape", name: "Pattern star", panel: "front", x: 1, y: 1, width: 2, height: 2, shape: "star", fill })],
  });
  assert.equal(doc.background.type, "pattern");
  assert.equal(doc.background.pattern.type, "stripes");
  assert.equal(doc.background.pattern.scale, 0.4);
  assert.match(coverFillCss(doc.background), /^#f5efe4 url\("data:image\/svg\+xml,/);
  assert.match(coverPatternDataUrl(doc.background.pattern), /^data:image\/svg\+xml,/);
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /data:image\/svg\+xml/);
  assert.match(markup, /<pattern /);
  const clamped = parseCoverDocument({ background: { ...fill, pattern: { ...pattern, scale: 99 } } });
  assert.equal(clamped.background.pattern.scale, 2);
});


test("cover image panning maps drag distance to clamped focus", () => {
  const tall = imageLayer({ id: "tall", name: "Tall", panel: "front", x: 0, y: 0, width: 4, height: 4, src: "data:image/png;base64,AA==" });
  const overflow = coverImageOverflow(tall, 1000, 1500);
  assert.equal(overflow.x, 0);
  assert.equal(overflow.y, 2);
  const panned = panCoverImageFocus(0.5, 0.5, 1, 1, overflow);
  assert.equal(panned.focusX, 0.5);
  assert.equal(panned.focusY, 0);
  assert.deepEqual(panCoverImageFocus(0.9, 0.1, -100, 100, { x: 2, y: 4 }), { focusX: 1, focusY: 0 });

  const wide = imageLayer({ id: "wide", name: "Wide", panel: "front", x: 0, y: 0, width: 4, height: 2, src: "data:image/png;base64,AA==" });
  assert.deepEqual(coverImageOverflow(wide, 2000, 1000), { x: 0, y: 0 });
  assert.deepEqual(coverImageOverflow({ ...wide, fit: "contain" }, 2000, 1000), { x: 0, y: 0 });
  assert.deepEqual(coverImageOverflow(wide, 0, 0), { x: 0, y: 0 });
});


test("layer fade masks persist, clamp, and render into markup", () => {
  const doc = parseCoverDocument({
    layers: [{
      id: "fade",
      type: "text",
      name: "Fade",
      panel: "front",
      x: 0.5,
      y: 0.5,
      width: 3,
      height: 2,
      text: "Fade",
      fade: { mode: "bottom", size: 0.4 },
    }],
  });
  assert.equal(doc.layers[0].fade.mode, "bottom");
  assert.equal(doc.layers[0].fade.size, 0.4);
  const css = coverLayerFadeCss(doc.layers[0]);
  assert.equal(css.maskImage, "linear-gradient(to top, transparent 0%, #000000 40%)");
  assert.equal(css.WebkitMaskImage, css.maskImage);
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /mask-image:linear-gradient\(to top, transparent 0%, #000000 40%\)/);
  assert.match(markup, /-webkit-mask-image:linear-gradient/);

  const legacy = parseCoverDocument({ layers: [{ id: "old", type: "text", name: "Old", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "Old" }] });
  assert.equal(legacy.layers[0].fade.mode, "none");
  assert.equal(legacy.layers[0].fade.size, 0.35);
  const clamped = parseCoverDocument({ layers: [{ ...doc.layers[0], fade: { mode: "vignette", size: 9 } }] });
  assert.equal(clamped.layers[0].fade.mode, "vignette");
  assert.equal(clamped.layers[0].fade.size, 1);
  assert.equal(coverLayerFadeCss(clamped.layers[0]).maskImage, "radial-gradient(ellipse at center, #000000 0%, transparent 100%)");
  assert.deepEqual(coverLayerFadeCss({ ...doc.layers[0], fade: { mode: "none", size: 0.4 } }), {});
});


test("expanded shape library builds real paths for markup and canvas", () => {
  const shapes = ["octagon", "shield", "ticket", "banner", "leaf", "arrow"];
  const layers = shapes.map((shape, index) => shapeLayer({ id: shape, name: shape, panel: "front", x: 0.5 + index * 0.1, y: 1, width: 1.5, height: 1.5, shape }));
  const doc = parseCoverDocument({ layers });
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  for (const shape of shapes) {
    const path = coverShapePath(shape);
    assert.match(path, /^M/);
    assert.ok(markup.includes(path));
    assert.equal(doc.layers.find((layer) => layer.id === shape).shape, shape);
  }
  const legacy = parseCoverDocument({ layers: [{ id: "unknown", type: "shape", name: "Unknown", panel: "front", x: 0, y: 0, width: 1, height: 1, shape: "not-a-shape" }] });
  assert.equal(legacy.layers[0].shape, "rectangle");
});


test("text highlight boxes persist and render in straight and curved text", () => {
  const doc = parseCoverDocument({
    layers: [{
      id: "highlight",
      type: "text",
      name: "Highlight",
      panel: "front",
      x: 0.5,
      y: 0.5,
      width: 3,
      height: 1,
      text: "Cover line",
      highlight: { enabled: true, color: "#f2c6a0", opacity: 0.5, padding: 0.04, radius: 0.02 },
    }],
  });
  assert.equal(doc.layers[0].highlight.enabled, true);
  assert.equal(doc.layers[0].highlight.opacity, 0.5);
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /cover-doc-text-highlight/);
  assert.match(markup, /background:rgba\(242, 198, 160, 0\.5\)/);
  assert.match(markup, /padding:0\.04in 0\.064in/);

  const curved = parseCoverDocument({ layers: [{ ...doc.layers[0], curve: 40 }] });
  const curvedMarkup = coverDocMarkup(book(), { ...cover(), doc: curved }, "front");
  assert.equal((curvedMarkup.match(/<text /g) || []).length, 2);

  const legacy = parseCoverDocument({ layers: [{ ...doc.layers[0], highlight: undefined }] });
  assert.equal(legacy.layers[0].highlight.enabled, false);
  const clamped = parseCoverDocument({ layers: [{ ...doc.layers[0], highlight: { enabled: true, color: "#ffffff", opacity: 9, padding: 9, radius: 9 } }] });
  assert.equal(clamped.layers[0].highlight.opacity, 1);
  assert.equal(clamped.layers[0].highlight.padding, 0.3);
  assert.equal(clamped.layers[0].highlight.radius, 0.2);
});


test("image layers keep source pixel dimensions for resolution checks", () => {
  const doc = parseCoverDocument({ layers: [{ id: "img", type: "image", name: "Image", panel: "front", x: 0, y: 0, width: 2, height: 3, src: "data:image/png;base64,AA==", sourceWidth: 600, sourceHeight: 900 }] });
  assert.equal(doc.layers[0].sourceWidth, 600);
  assert.equal(doc.layers[0].sourceHeight, 900);
  const legacy = parseCoverDocument({ layers: [{ id: "old", type: "image", name: "Old", panel: "front", x: 0, y: 0, width: 2, height: 3, src: "x" }] });
  assert.equal(legacy.layers[0].sourceWidth, 0);
  assert.equal(legacy.layers[0].sourceHeight, 0);
  const clamped = parseCoverDocument({ layers: [{ ...doc.layers[0], sourceWidth: 999999, sourceHeight: -2 }] });
  assert.equal(clamped.layers[0].sourceWidth, 100000);
  assert.equal(clamped.layers[0].sourceHeight, 0);
  assert.equal(imageLayer({ id: "plain", name: "Plain", panel: "front", x: 0, y: 0, width: 1, height: 1, src: "x" }).sourceWidth, 0);
});


test("gradient presets are valid and reverse keeps stop order", () => {
  assert.ok(COVER_GRADIENT_PRESETS.length >= 5);
  for (const preset of COVER_GRADIENT_PRESETS) {
    assert.equal(preset.gradient.stops.length, 2);
    assert.ok(preset.gradient.stops.every((stop) => /^#[0-9a-f]{6}$/i.test(stop.color)));
  }
  const input = { type: "linear", angle: 135, stops: [{ color: "#111111", position: 0.1 }, { color: "#eeeeee", position: 0.9 }, { color: "#ff0000", position: 0.5 }] };
  const reversed = reverseCoverGradient(input);
  assert.deepEqual(reversed.stops.map((stop) => stop.color), ["#eeeeee", "#ff0000", "#111111"]);
  assert.deepEqual(reversed.stops.map((stop) => stop.position), [0.1, 0.5, 0.9]);
  assert.equal(input.stops[0].position, 0.1);
  assert.equal(reversed.angle, 135);
});


test("installed font overrides persist, sanitize, and render consistently", () => {
  const doc = parseCoverDocument({ layers: [{ id: "custom", type: "text", name: "Custom", panel: "front", x: 0, y: 0, width: 3, height: 1, text: "Custom", customFont: '  "Bodoni 72"; <Bad>  ' }] });
  assert.equal(doc.layers[0].customFont, "Bodoni 72 Bad");
  assert.equal(coverFontCss("serif", doc.layers[0].customFont), "'Bodoni 72 Bad', Georgia, serif");
  assert.equal(coverFontCss("serif", "'Unsafe';{}"), "'Unsafe', Georgia, serif");
  assert.equal(coverFontCss("serif", ""), "Georgia, 'Times New Roman', serif");
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /font-family:'Bodoni 72 Bad', Georgia, serif/);
  const legacy = parseCoverDocument({ layers: [{ ...doc.layers[0], customFont: undefined }] });
  assert.equal(legacy.layers[0].customFont, "");
});


test("shape clipping masks persist, validate targets, and hide with the base", () => {
  const base = shapeLayer({ id: "mask", name: "Mask", panel: "front", x: 1, y: 1, width: 2, height: 2, shape: "ellipse" });
  const clipped = textLayer({ id: "clipped", name: "Clipped", panel: "front", x: 0.5, y: 0.5, width: 4, height: 4, text: "Inside", clipTo: "mask" });
  const doc = parseCoverDocument({ layers: [base, clipped] });
  assert.equal(doc.layers.find((layer) => layer.id === "clipped").clipTo, "mask");
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /clip-path:path\('/);
  assert.match(markup, /Inside/);

  const hidden = parseCoverDocument({ layers: [{ ...base, visible: false }, clipped] });
  const hiddenMarkup = coverDocMarkup(book(), { ...cover(), doc: hidden }, "front");
  assert.doesNotMatch(hiddenMarkup, /Inside/);

  const invalid = parseCoverDocument({ layers: [clipToText(), { ...clipped, clipTo: "text-base" }] });
  assert.equal(invalid.layers.find((layer) => layer.id === "clipped").clipTo, null);
  const missing = parseCoverDocument({ layers: [{ ...clipped, clipTo: "missing" }] });
  assert.equal(missing.layers[0].clipTo, null);
});

function clipToText() {
  return textLayer({ id: "text-base", name: "Text base", panel: "front", x: 0, y: 0, width: 2, height: 1, text: "Base" });
}

test("clipping matrix maps shape coordinates into the clipped layer local space", () => {
  const base = { x: 1, y: 1, width: 2, height: 2 };
  const layer = { x: 1, y: 1, width: 4, height: 4 };
  assert.deepEqual(coverLayerClipMatrix(base, 0, layer, 0, 96), [1.92, 0, 0, 1.92, 0, 0]);
  const rotated = coverLayerClipMatrix(base, 0, layer, 90, 96);
  assert.notDeepEqual(rotated, [1.92, 0, 0, 1.92, 0, 0]);
  const doc = parseCoverDocument({ layers: [shapeLayer({ id: "mask", name: "Mask", panel: "front", x: 1, y: 1, width: 2, height: 2, shape: "star" }), textLayer({ id: "clipped", name: "Clipped", panel: "front", x: 1, y: 1, width: 4, height: 4, text: "Inside", clipTo: "mask" })] });
  assert.match(coverLayerClipCss(book(), { ...cover(), doc }, doc.layers[1]).clipPath, /^path\('M/);
});


test("group reordering moves whole blocks only while unlocked", () => {
  const layers = [
    textLayer({ id: "bottom", name: "Bottom", panel: "front", x: 0, y: 0, width: 1, height: 1, text: "Bottom" }),
    textLayer({ id: "g1-a", name: "G1 A", panel: "front", x: 0, y: 0, width: 1, height: 1, text: "A", groupId: "g1" }),
    textLayer({ id: "g1-b", name: "G1 B", panel: "front", x: 0, y: 0, width: 1, height: 1, text: "B", groupId: "g1" }),
    textLayer({ id: "middle", name: "Middle", panel: "front", x: 0, y: 0, width: 1, height: 1, text: "Middle" }),
    textLayer({ id: "g2", name: "G2", panel: "front", x: 0, y: 0, width: 1, height: 1, text: "G2", groupId: "g2" }),
  ];
  const doc = parseCoverDocument({
    groups: [
      { id: "g1", name: "Group one", visible: true, locked: false, collapsed: false },
      { id: "g2", name: "Group two", visible: true, locked: true, collapsed: false },
    ],
    layers,
  });
  const movedUp = reorderCoverGroup(doc, "g1", "up");
  assert.ok(movedUp);
  assert.deepEqual(movedUp.layers.map((layer) => layer.id), ["bottom", "middle", "g1-a", "g1-b", "g2"]);
  const movedDown = reorderCoverGroup(doc, "g1", "down");
  assert.ok(movedDown);
  assert.deepEqual(movedDown.layers.map((layer) => layer.id), ["g1-a", "g1-b", "bottom", "middle", "g2"]);
  assert.equal(coverGroupLocked(doc, "g1"), false);
  assert.equal(coverGroupLocked(doc, "g2"), true);
  assert.equal(reorderCoverGroup(doc, "g2", "down"), null);
  const childLocked = parseCoverDocument({ ...doc, layers: doc.layers.map((layer) => layer.id === "g1-b" ? { ...layer, locked: true } : layer) });
  assert.equal(coverGroupLocked(childLocked, "g1"), true);
  assert.equal(reorderCoverGroup(childLocked, "g1", "down"), null);
});


test("image erase masks normalize and render as layer masks", () => {
  const layer = imageLayer({
    id: "masked-photo",
    name: "Masked photo",
    panel: "front",
    x: 0,
    y: 0,
    width: 3,
    height: 4,
    src: "data:image/png;base64,AAA",
    eraseMask: "data:image/webp;base64,BBBB",
  });
  const doc = parseCoverDocument({ layers: [layer] });
  const image = doc.layers[0];
  assert.equal(image.type, "image");
  assert.equal(image.eraseMask, "data:image/webp;base64,BBBB");
  const markup = coverDocMarkup(book(), { ...cover(), doc }, "front");
  assert.match(markup, /-webkit-mask-image:url\('data:image\/webp;base64,BBBB'\)/);
  assert.match(markup, /mask-image:url\('data:image\/webp;base64,BBBB'\)/);
  assert.match(markup, /mask-size:100% 100%/);
  const legacy = parseCoverDocument({
    layers: [{ id: "legacy", type: "image", panel: "front", x: 0, y: 0, width: 2, height: 3, src: "data:," }],
  });
  assert.equal(legacy.layers[0].eraseMask, "");
  const malformed = parseCoverDocument({
    layers: [{ id: "bad", type: "image", panel: "front", x: 0, y: 0, width: 2, height: 3, src: "data:,", eraseMask: 42 }],
  });
  assert.equal(malformed.layers[0].eraseMask, "");
});

test("photo-led templates ship stock imagery, groups, and full wrap matter", () => {
  const ids = ["tidewater", "dunes", "highland", "wildflower", "meridian", "afterhours"];
  assert.ok(COVER_TEMPLATE_PRESETS.length >= 12);
  for (const id of ids) {
    assert.ok(COVER_TEMPLATE_PRESETS.some((preset) => preset.id === id), id);
    const doc = createCoverDocument(id, book(), cover());
    assert.equal(doc.templateId, id);
    assert.ok(doc.layers.some((layer) => layer.type === "image" && layer.panel === "front" && layer.src.startsWith("/cover-templates/")), `${id} photo`);
    assert.ok(doc.layers.some((layer) => layer.type === "text" && layer.panel === "spine"), `${id} spine`);
    assert.ok(doc.layers.some((layer) => layer.type === "barcode" && layer.panel === "back"), `${id} barcode`);
    assert.ok(doc.groups.length >= 2, `${id} groups`);
    for (const group of doc.groups) {
      assert.ok(doc.layers.some((layer) => layer.groupId === group.id), `${id} ${group.id} has layers`);
    }
    const markup = coverDocMarkup(book(), { ...cover(), doc }, "wrap");
    assert.match(markup, /The Quiet Hour/);
    assert.match(markup, /\/cover-templates\//);
    const parsed = parseCoverDocument(JSON.parse(JSON.stringify(doc)));
    assert.equal(parsed.layers.length, doc.layers.length);
    assert.equal(parsed.groups.length, doc.groups.length);
    assert.equal(parsed.groups[0].id, doc.groups[0].id);
  }
});
