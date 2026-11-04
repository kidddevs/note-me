const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_SAVED_COVER_STYLE_NAME,
  SAVED_COVER_STYLES_KEY,
  applyLayerStyle,
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
    const deleted = deleteLayerStylePreset(saved.presets[0].id, readLayerStylePresets());
    assert.equal(deleted.ok, true);
    assert.equal(readLayerStylePresets().length, 0);
  } finally {
    global.window = previousWindow;
  }
});
