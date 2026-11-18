const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_SAVED_COVER_STYLE_NAME,
  MAX_SAVED_COVER_STYLES,
  SAVED_COVER_STYLES_KEY,
  applyLayerStyle,
  styleCoverSelection,
  createLayerStylePreset,
  deleteLayerStylePreset,
  parseLayerStylePresets,
  readLayerStylePresets,
  renameLayerStylePreset,
  saveLayerStylePreset,
  serializeLayerStylePresets,
  styleValuesFromLayer,
} = require("./.compiled/src/lib/bookCoverStyles");
const {
  imageLayer,
  lineLayer,
  shapeLayer,
  textLayer,
  coverFill,
  emptyCoverDocument,
} = require("./.compiled/src/lib/bookCoverDoc");

function richTextLayer() {
  return textLayer({
    id: "title",
    name: "Title",
    panel: "front",
    x: 1,
    y: 2,
    width: 4,
    height: 1.2,
    text: "{{title}}",
    fontFamily: "display",
    fontSize: 42,
    fontWeight: 700,
    italic: true,
    letterSpacing: 0.02,
    color: "#f5efe4",
    uppercase: true,
    effect: "outline",
    effectColor: "#1f3a2d",
    curve: 18,
    customFont: "Bodoni 72 Smallcaps",
    highlight: { enabled: true, color: "#f2c6a0", opacity: 0.5, padding: 0.04, radius: 0.02 },
    opacity: 0.92,
    blendMode: "screen",
  });
}

test("layer styles capture appearance but never content or geometry", () => {
  const layer = richTextLayer();
  layer.shadow.enabled = true;
  layer.shadow.color = "#112233";
  const values = styleValuesFromLayer(layer);
  assert.equal(values.fontSize, 42);
  assert.equal(values.fontFamily, "display");
  assert.equal(values.color, "#f5efe4");
  assert.equal(values.curve, 18);
  assert.equal(values.customFont, "Bodoni 72 Smallcaps");
  assert.equal(values.highlight.enabled, true);
  assert.equal(values.opacity, 0.92);
  assert.equal(values.shadow.enabled, true);
  assert.equal("text" in values, false);
  assert.equal("x" in values, false);
  assert.equal("src" in values, false);

  layer.shadow.color = "#ffffff";
  assert.equal(values.shadow.color, "#112233");
});

test("styles apply shared appearance everywhere and type settings only where they fit", () => {
  const text = richTextLayer();
  const values = styleValuesFromLayer(text);

  const otherText = textLayer({ id: "sub", name: "Sub", panel: "front", x: 0, y: 0, width: 3, height: 1, text: "Sub" });
  const textPatch = applyLayerStyle(otherText, values);
  assert.equal(textPatch.fontSize, 42);
  assert.equal(textPatch.fontFamily, "display");
  assert.equal(textPatch.color, "#f5efe4");
  assert.equal(textPatch.highlight.opacity, 0.5);
  assert.equal(textPatch.customFont, "Bodoni 72 Smallcaps");

  const shape = shapeLayer({ id: "shape", name: "Shape", panel: "front", x: 0, y: 0, width: 2, height: 2, shape: "star" });
  const shapePatch = applyLayerStyle(shape, values);
  assert.equal(shapePatch.opacity, 0.92);
  assert.equal(shapePatch.blendMode, "screen");
  assert.equal("fontSize" in shapePatch, false);
  assert.equal("fill" in shapePatch, false);

  const line = lineLayer({ id: "line", name: "Line", panel: "front", x: 0, y: 0, width: 3, height: 0.04 });
  const linePatch = applyLayerStyle(line, values);
  assert.equal(linePatch.color, "#f5efe4");
  assert.equal("fontSize" in linePatch, false);
});

test("style scopes isolate typography, fills, shared effects and photo grading", () => {
  const values = styleValuesFromLayer(richTextLayer());
  const target = richTextLayer();
  const typography = applyLayerStyle(target, values, "typography");
  assert.equal(typography.fontSize, 42);
  assert.equal(typography.customFont, "Bodoni 72 Smallcaps");
  assert.equal("color" in typography, false);
  assert.equal("opacity" in typography, false);
  assert.equal("highlight" in typography, false);
  assert.deepEqual(applyLayerStyle(target, values, "colors"), { color: "#f5efe4", effectColor: "#1f3a2d" });
  assert.deepEqual(Object.keys(applyLayerStyle(target, values, "effects")).sort(), ["blendMode", "fade", "glow", "opacity", "shadow"]);
  assert.deepEqual(applyLayerStyle(target, values, "grading"), {});

  const shape = shapeLayer({ id: "shape", name: "Shape", panel: "front", x: 0, y: 0, width: 2, height: 2, fill: coverFill("#eb7304"), strokeColor: "#00ff00", strokeWidth: 0.06 });
  const fill = applyLayerStyle(shape, styleValuesFromLayer(shape), "colors");
  assert.deepEqual(Object.keys(fill).sort(), ["fill", "strokeColor"]);
  assert.equal("strokeWidth" in fill, false);
  const photo = imageLayer({ id: "photo", name: "Photo", panel: "front", x: 0, y: 0, width: 2, height: 2, src: "original", fit: "contain", focusX: 0.1, brightness: 120, mask: "arch", radius: 0.2 });
  const grading = applyLayerStyle(photo, styleValuesFromLayer(photo), "grading");
  assert.equal(grading.brightness, 120);
  assert.equal("fit" in grading, false);
  assert.equal("mask" in grading, false);
  assert.equal("radius" in grading, false);
  assert.equal("focusX" in grading, false);
});

test("styling a mixed selection is atomic, skips matching or incompatible layers and preserves their content", () => {
  const title = richTextLayer();
  const other = textLayer({ id: "other", name: "Other", panel: "back", x: 2, y: 3, width: 1, height: 1, text: "Keep me" });
  const image = imageLayer({ id: "photo", name: "Photo", panel: "front", x: 0, y: 0, width: 2, height: 2, src: "original" });
  const doc = { ...emptyCoverDocument(), layers: [title, other, image] };
  const snapshot = JSON.stringify(doc);
  const values = styleValuesFromLayer(title);
  const patches = styleCoverSelection(doc, ["title", "other", "photo", "other"], values, "typography");
  assert.deepEqual(patches.map((entry) => entry.id), ["other"]);
  const result = { ...other, ...patches[0].patch };
  assert.equal(result.text, "Keep me");
  assert.equal(result.x, 2);
  assert.equal(result.color, other.color);
  assert.equal(JSON.stringify(doc), snapshot);
  patches[0].patch.fontSize = 99;
  assert.equal(title.fontSize, 42);

  assert.deepEqual(styleCoverSelection(doc, ["title", "deleted"], values), []);
  other.locked = true;
  assert.deepEqual(styleCoverSelection(doc, ["title", "other", "photo"], values), []);
  other.locked = false;
  other.groupId = "locked-group";
  doc.groups = [{ id: "locked-group", name: "Locked", visible: true, locked: true, collapsed: false }];
  assert.deepEqual(styleCoverSelection(doc, ["title", "other"], values, "colors"), []);
});

test("shape and image style values carry fills, strokes, grading, and masks", () => {
  const shape = shapeLayer({ id: "shape", name: "Shape", panel: "front", x: 0, y: 0, width: 2, height: 2, shape: "arch", fill: { ...coverFill("#c96b3b"), type: "pattern" }, radius: 0.2, strokeColor: "#ffffff", strokeWidth: 0.03, dash: "dotted" });
  const shapeValues = styleValuesFromLayer(shape);
  assert.equal(shapeValues.fill.type, "pattern");
  const image = imageLayer({ id: "img", name: "Image", panel: "front", x: 0, y: 0, width: 2, height: 2, src: "data:image/png;base64,AA==" });
  const imagePatch = applyLayerStyle(image, shapeValues);
  assert.equal(imagePatch.radius, 0.2);
  assert.equal("fill" in imagePatch, false);

  const graded = imageLayer({ id: "img2", name: "Graded", panel: "front", x: 0, y: 0, width: 2, height: 2, src: "x", grayscale: true, brightness: 112, mask: "circle", tint: "#c96b3b", tintStrength: 0.4 });
  const gradedValues = styleValuesFromLayer(graded);
  const imagePatch2 = applyLayerStyle(image, gradedValues);
  assert.equal(imagePatch2.grayscale, true);
  assert.equal(imagePatch2.mask, "circle");
  const textPatch = applyLayerStyle(richTextLayer(), gradedValues);
  assert.equal("grayscale" in textPatch, false);
});

test("style presets persist, rename, delete, and repair corrupted values", () => {
  const layer = richTextLayer();
  const preset = createLayerStylePreset("  Editorial title  ", layer, new Date("2026-06-07T08:09:10Z"));
  assert.equal(preset.name, "Editorial title");
  assert.equal(preset.createdAt, "2026-06-07T08:09:10.000Z");
  assert.equal(preset.values.fontSize, 42);
  assert.equal(preset.name.length <= MAX_SAVED_COVER_STYLE_NAME, true);

  const wire = JSON.parse(serializeLayerStylePresets([
    preset,
    { ...preset, name: "Second" },
    { ...preset, name: "Broken", sourceType: "unknown" },
    { ...preset, name: "Clamped", values: { ...preset.values, opacity: 8, blendMode: "not-a-blend", fontSize: 999, color: "not-a-colour" } },
  ]));
  const parsed = parseLayerStylePresets(wire, new Date("2026-07-08T09:10:11Z"));
  assert.equal(parsed.length, 3);
  assert.notEqual(parsed[0].id, parsed[1].id);
  assert.equal(parsed[2].values.opacity, 1);
  assert.equal(parsed[2].values.blendMode, "normal");
  assert.equal(parsed[2].values.fontSize, 240);
  assert.equal(parsed[2].values.color, "#211b16");

  const previousWindow = global.window;
  const map = new Map();
  global.window = { localStorage: {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  } };
  try {
    const saved = saveLayerStylePreset("Saved title", layer, []);
    assert.equal(saved.ok, true);
    assert.equal(saved.presets.length, 1);
    assert.ok(map.has(SAVED_COVER_STYLES_KEY));
    assert.equal(readLayerStylePresets()[0].name, "Saved title");
    const renamed = renameLayerStylePreset(saved.presets[0].id, "Renamed title", readLayerStylePresets());
    assert.equal(renamed.ok, true);
    assert.equal(readLayerStylePresets()[0].name, "Renamed title");
    const fullLibrary = Array.from({ length: MAX_SAVED_COVER_STYLES }, (_, index) => ({ ...saved.presets[0], id: `saved-${index}` }));
    map.set(SAVED_COVER_STYLES_KEY, serializeLayerStylePresets(fullLibrary));
    const rejected = saveLayerStylePreset("One too many", layer, fullLibrary);
    assert.equal(rejected.ok, false);
    assert.deepEqual(readLayerStylePresets(), fullLibrary);
    map.set(SAVED_COVER_STYLES_KEY, serializeLayerStylePresets(saved.presets));
    const deleted = deleteLayerStylePreset(saved.presets[0].id, readLayerStylePresets());
    assert.equal(deleted.ok, true);
    assert.equal(readLayerStylePresets().length, 0);
  } finally {
    global.window = previousWindow;
  }
});
