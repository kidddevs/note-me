const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_SAVED_COVER_TEMPLATE_NAME,
  SAVED_COVER_TEMPLATES_KEY,
  adaptCoverDocumentToMetrics,
  createSavedCoverTemplate,
  deleteSavedCoverTemplate,
  parseSavedCoverTemplates,
  readSavedCoverTemplates,
  renameCoverTemplate,
  saveCoverTemplate,
  savedTemplateDocument,
  serializeSavedCoverTemplates,
} = require("./.compiled/src/lib/bookCoverLibrary");
const {
  coverFill,
  coverMetrics,
  emptyCoverDocument,
  parseCoverDocument,
  shapeLayer,
  textLayer,
} = require("./.compiled/src/lib/bookCoverDoc");

const book = { trim_size: "6x9" };
const cover = { pageCount: 320, paperStock: "cream-60", spineWidthOverride: 0, bleed: 0.125 };
const metrics = coverMetrics("6x9", cover);

function sampleDoc() {
  return {
    ...emptyCoverDocument(),
    templateId: "atelier",
    palette: ["#f5efe4", "#2a211b", "#a56b3e"],
    layers: [
      textLayer({ id: "title", name: "Title", panel: "front", x: 1, y: 1, width: 4, height: 2, text: "{{title}}" }),
      shapeLayer({ id: "spine-rule", name: "Spine rule", panel: "spine", x: 0.1, y: 0.6, width: 0.3, height: 3, shape: "rectangle", fill: coverFill("#a56b3e") }),
      shapeLayer({ id: "wrap-band", name: "Wrap band", panel: "wrap", x: 1, y: 4, width: 10, height: 1, shape: "rectangle", fill: coverFill("#2a211b") }),
    ],
    guides: [
      { id: "front-x", axis: "x", panel: "front", position: 3 },
      { id: "wrap-y", axis: "y", panel: "wrap", position: 4.5 },
    ],
  };
}

test("saved cover templates snapshot metrics, clamp names, and normalize documents", () => {
  const longName = "A".repeat(MAX_SAVED_COVER_TEMPLATE_NAME + 14);
  const template = createSavedCoverTemplate(longName, sampleDoc(), metrics, new Date("2026-01-02T03:04:05Z"));
  assert.equal(template.name.length, MAX_SAVED_COVER_TEMPLATE_NAME);
  assert.equal(template.createdAt, "2026-01-02T03:04:05.000Z");
  assert.equal(template.metrics.trimWidth, 6);
  assert.equal(template.metrics.spineWidth, metrics.spineWidth);
  assert.equal(template.doc.layers.length, 3);
  assert.equal(template.doc.layers[0].text, "{{title}}");

  const unnamed = createSavedCoverTemplate("   ", sampleDoc(), metrics);
  assert.equal(unnamed.name, "Untitled template");
});

test("saved template parsing drops invalid entries and repairs duplicate ids", () => {
  const template = createSavedCoverTemplate("First", sampleDoc(), metrics, new Date("2026-01-02T03:04:05Z"));
  const wire = JSON.parse(serializeSavedCoverTemplates([template, { ...template, name: "Second" }, { name: "" }, { name: "No metrics", doc: sampleDoc() }, null]));
  const parsed = parseSavedCoverTemplates(wire, new Date("2026-03-04T05:06:07Z"));
  assert.equal(parsed.length, 2);
  assert.notEqual(parsed[0].id, parsed[1].id);
  assert.equal(parsed[0].metrics.trimWidth, 6);
  assert.equal(parsed[1].name, "Second");
});

test("saved templates reflow panels and guides to a different trim and spine", () => {
  const doc = parseCoverDocument(sampleDoc());
  const from = { trimWidth: 6, trimHeight: 9, spineWidth: 0.5, bleed: 0.125, fullWidth: 12.75, fullHeight: 9.25 };
  const to = { trimWidth: 5.5, trimHeight: 8.5, spineWidth: 0.375, bleed: 0.125, fullWidth: 11.625, fullHeight: 8.75 };
  const adapted = adaptCoverDocumentToMetrics(doc, from, to);
  const title = adapted.layers.find((layer) => layer.id === "title");
  const spine = adapted.layers.find((layer) => layer.id === "spine-rule");
  const band = adapted.layers.find((layer) => layer.id === "wrap-band");
  assert.equal(title.x, 0.917);
  assert.equal(title.y, 0.944);
  assert.equal(title.width, 3.667);
  assert.equal(title.height, 1.889);
  assert.equal(spine.x, 0.075);
  assert.equal(spine.width, 0.225);
  assert.equal(band.x, 0.912);
  assert.equal(band.width, 9.118);
  assert.equal(band.y, 3.784);
  assert.equal(adapted.guides.find((guide) => guide.id === "front-x").position, 2.75);
  assert.equal(adapted.guides.find((guide) => guide.id === "wrap-y").position, 4.257);

  const template = createSavedCoverTemplate("Reflow", doc, metrics);
  const same = savedTemplateDocument(template, metrics);
  assert.equal(same.layers[0].x, 1);
  const smaller = savedTemplateDocument(template, coverMetrics("5.5x8.5", { ...cover, pageCount: 220 }));
  assert.equal(smaller.layers[0].width, 3.667);
});

test("saved template storage supports save, read, rename, delete, and quota failures", () => {
  const previousWindow = global.window;
  const map = new Map();
  const store = {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  global.window = { localStorage: store };
  try {
    assert.deepEqual(readSavedCoverTemplates(), []);
    const saved = saveCoverTemplate("Reusable wrap", sampleDoc(), metrics, []);
    assert.equal(saved.ok, true);
    assert.equal(saved.templates.length, 1);
    assert.ok(map.has(SAVED_COVER_TEMPLATES_KEY));
    assert.equal(readSavedCoverTemplates()[0].name, "Reusable wrap");

    const renamed = renameCoverTemplate(saved.templates[0].id, "Renamed wrap", readSavedCoverTemplates());
    assert.equal(renamed.ok, true);
    assert.equal(readSavedCoverTemplates()[0].name, "Renamed wrap");

    const deleted = deleteSavedCoverTemplate(saved.templates[0].id, readSavedCoverTemplates());
    assert.equal(deleted.ok, true);
    assert.equal(readSavedCoverTemplates().length, 0);

    const failing = saveCoverTemplate("Too big", sampleDoc(), metrics, []);
    assert.equal(failing.ok, true);
    store.setItem = () => { throw new Error("QuotaExceededError"); };
    const failed = saveCoverTemplate("No room", sampleDoc(), metrics, []);
    assert.equal(failed.ok, false);
    assert.match(failed.message, /local storage is full/i);
  } finally {
    global.window = previousWindow;
  }
});
