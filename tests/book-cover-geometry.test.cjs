const test = require("node:test");
const assert = require("node:assert/strict");
const {
  alignCoverLayers,
  coverGuidePanelPosition,
  coverGuideSpreadPosition,
  distributeCoverLayers,
  snapCoverRect,
  coverSelectionBounds,
  coverSpreadRect,
  transformCoverSelection,
} = require("./.compiled/src/lib/bookCoverGeometry.js");
const {
  parseCoverDocument,
  reflowSpineLayers,
  shapeLayer,
  textLayer,
  imageLayer,
  lineLayer,
} = require("./.compiled/src/lib/bookCoverDoc.js");

const metrics = {
  trimWidth: 6,
  trimHeight: 9,
  spineWidth: 1,
  bleed: 0.125,
  fullWidth: 13.25,
  fullHeight: 9.25,
  trimWidthTotal: 13,
  panelWidths: { back: 6, spine: 1, front: 6 },
  panelOrigins: { back: { x: 0.125, y: 0.125 }, spine: { x: 6.125, y: 0.125 }, front: { x: 7.125, y: 0.125 } },
};

function layer(id, panel, x, y, width = 1, height = 1) {
  return { id, type: "shape", name: id, panel, x, y, width, height, rotation: 0, opacity: 1, blendMode: "normal", visible: true, locked: false };
}

test("alignment uses the shared selection bounds", () => {
  const layers = [layer("a", "front", 0.5, 0.5), layer("b", "front", 3, 2)];
  const left = alignCoverLayers(metrics, layers, "left");
  assert.deepEqual(left.map((patch) => patch.x), [0.5, 0.5]);
  const right = alignCoverLayers(metrics, layers, "right");
  assert.deepEqual(right.map((patch) => patch.x), [3, 3]);
  const middle = alignCoverLayers(metrics, layers, "middle");
  assert.deepEqual(middle.map((patch) => patch.y), [1.25, 1.25]);
});

test("distribution creates equal gaps between the outer layers", () => {
  const layers = [layer("a", "front", 0.5, 0.5), layer("b", "front", 3, 0.5), layer("c", "front", 6, 0.5)];
  const patches = distributeCoverLayers(metrics, layers, "horizontal");
  assert.deepEqual(patches.map((patch) => patch.x), [0.5, 3.25, 6]);
});

test("smart snapping honours edges, centres, and the threshold", () => {
  const snapped = snapCoverRect({ x: 0.5, y: 0.5, width: 1, height: 1 }, [0.52], [0.98]);
  assert.equal(snapped.x, 0.52);
  assert.equal(snapped.y, 0.48);
  assert.deepEqual(snapped.vertical, [0.52]);
  assert.deepEqual(snapped.horizontal, [0.98]);
  const centred = snapCoverRect({ x: 0.48, y: 0.48, width: 1, height: 1 }, [1], [1]);
  assert.equal(centred.x, 0.5);
  assert.equal(centred.y, 0.5);
});

test("guides convert between panel and spread coordinates", () => {
  const guide = { id: "g", axis: "x", panel: "front", position: 1.25 };
  assert.equal(coverGuideSpreadPosition(metrics, guide), 8.375);
  assert.equal(coverGuidePanelPosition(metrics, guide, 8.375), 1.25);
  const wrapGuide = { id: "g2", axis: "y", panel: "wrap", position: 2 };
  assert.equal(coverGuideSpreadPosition(metrics, wrapGuide), 2);
});

test("cover documents persist guides and ruler visibility", () => {
  const parsed = parseCoverDocument({
    guides: [
      { id: "g1", axis: "x", panel: "front", position: 1.4 },
      { id: "g2", axis: "y", panel: "spine", position: 999 },
      { id: "bad", axis: "z", panel: "nope", position: 2 },
    ],
    showRulers: true,
  });
  assert.equal(parsed.guides.length, 3);
  assert.equal(parsed.guides[0].position, 1.4);
  assert.equal(parsed.guides[1].position, 100);
  assert.equal(parsed.guides[2].axis, "x");
  assert.equal(parsed.guides[2].panel, "front");
  assert.equal(parsed.showRulers, true);
});

test("spine reflow keeps spine guides centred", () => {
  const doc = parseCoverDocument({
    guides: [{ id: "g", axis: "x", panel: "spine", position: 0.4 }],
  });
  const next = reflowSpineLayers(doc, 1, 1.2);
  assert.equal(next.guides[0].position, 0.5);
  assert.equal(next.layers.length, 0);
});

const shape = (id, overrides = {}) => shapeLayer({ id, name: id, panel: "wrap", x: 0, y: 0, width: 1, height: 1, ...overrides });
const documentWith = (layers, groups = []) => parseCoverDocument({ layers, groups });
const apply = (doc, updates) => ({ ...doc, layers: doc.layers.map((layer) => ({ ...layer, ...updates.find((u) => u.id === layer.id)?.patch })) });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.002, `${actual} != ${expected}`);

test("selection scaling preserves panel ownership, visual center, and source metadata", () => {
  const doc = documentWith([
    textLayer({ id: "title", name: "Title", panel: "front", x: 0, y: 1, width: 2, height: 1, fontSize: 20, rotation: 15 }),
    imageLayer({ id: "photo", name: "Photo", panel: "back", x: 1, y: 2, width: 2, height: 2, src: "data:image/png;base64,AA==", sourceWidth: 100, sourceHeight: 100, credit: "Archive", eraseMask: "painted-mask", focusX: 0.8 }),
  ]);
  const before = JSON.stringify(doc);
  const bounds = coverSelectionBounds(metrics, doc.layers);
  const updates = transformCoverSelection(metrics, doc, ["photo", "title"], { scale: 1.5 });
  const next = apply(doc, updates);
  const resized = coverSelectionBounds(metrics, next.layers);
  close(resized.x + resized.width / 2, bounds.x + bounds.width / 2);
  close(resized.y + resized.height / 2, bounds.y + bounds.height / 2);
  close(resized.width, bounds.width * 1.5);
  assert.equal(next.layers[0].fontSize, 30);
  assert.equal(next.layers[0].panel, "front");
  assert.equal(next.layers[1].panel, "back");
  assert.equal(next.layers[1].eraseMask, "painted-mask");
  assert.equal(next.layers[1].credit, "Archive");
  assert.equal(next.layers[1].focusX, 0.8);
  assert.deepEqual(parseCoverDocument(next), next);
  assert.equal(JSON.stringify(doc), before);
});

test("selection rotation moves all centers around the shared pivot and preserves dimensions", () => {
  const doc = documentWith([shape("a"), shape("b", { x: 2 })]);
  const next = apply(doc, transformCoverSelection(metrics, doc, ["a", "b"], { rotation: 90 }));
  assert.deepEqual(next.layers.map(({ x, y, width, height, rotation }) => ({ x, y, width, height, rotation })), [
    { x: 1, y: -1, width: 1, height: 1, rotation: 90 }, { x: 1, y: 1, width: 1, height: 1, rotation: 90 },
  ]);
  const original = apply(next, transformCoverSelection(metrics, next, ["a", "b"], { rotation: -90 }));
  assert.deepEqual(original.layers, doc.layers);
});

test("corner scaling anchors the opposite corner and scales typography and physical effects", () => {
  const doc = documentWith([shape("shape", { strokeWidth: 0.05, radius: 0.2 }), textLayer({ id: "text", name: "Text", panel: "wrap", x: 2, y: 0, width: 1, height: 1, fontSize: 24 })]);
  doc.layers[1].shadow.enabled = true;
  doc.layers[1].highlight.enabled = true;
  const updates = transformCoverSelection(metrics, doc, ["shape", "text"], { scale: 2, anchor: { x: 0, y: 0 } });
  const next = apply(doc, updates);
  assert.equal(next.layers[0].x, 0);
  assert.equal(next.layers[0].strokeWidth, 0.1);
  assert.equal(next.layers[0].radius, 0.4);
  assert.equal(next.layers[1].x, 4);
  assert.equal(next.layers[1].fontSize, 48);
  assert.equal(next.layers[1].shadow.blur, doc.layers[1].shadow.blur * 2);
  assert.equal(next.layers[1].highlight.padding, doc.layers[1].highlight.padding * 2);
});

test("inactive effect defaults do not limit otherwise valid selection scaling", () => {
  const doc = documentWith([shape("a"), shape("b", { x: 2 })]);
  const updates = transformCoverSelection(metrics, doc, ["a", "b"], { scale: 8 });
  assert.equal(updates.length, 2);
  assert.equal(updates[0].patch.width, 8);
  assert.equal(updates[0].patch.shadow, undefined);
  assert.equal(updates[0].patch.glow, undefined);
});

test("typography groups with hairline rules can shrink and survive normalization", () => {
  const doc = documentWith([
    textLayer({ id: "title", name: "Title", panel: "front", x: 0.5, y: 1, width: 5, height: 1, fontSize: 36 }),
    lineLayer({ id: "rule", name: "Rule", panel: "front", x: 0.5, y: 3, width: 5, height: 0.02 }),
  ]);
  const next = apply(doc, transformCoverSelection(metrics, doc, ["title", "rule"], { scale: 0.95 }));
  assert.equal(next.layers[0].fontSize, 34.2);
  assert.equal(next.layers[1].height, 0.019);
  assert.deepEqual(parseCoverDocument(next), next);
  assert.equal(parseCoverDocument({ layers: [{ ...doc.layers[1], height: 0.00001 }] }).layers[0].height, 0.001);
});

test("locked groups, missing layers and invalid scales reject the whole transform", () => {
  const doc = documentWith([shape("a"), shape("b", { groupId: "locked" })], [{ id: "locked", name: "Locked", locked: true, visible: true, collapsed: false }]);
  assert.deepEqual(transformCoverSelection(metrics, doc, ["a", "b"], { dx: 1 }), []);
  assert.deepEqual(transformCoverSelection(metrics, doc, ["a", "missing"], { dx: 1 }), []);
  for (const scale of [NaN, Infinity, 0, -1, 10000, 0.001]) assert.deepEqual(transformCoverSelection(metrics, doc, ["a"], { scale }), []);
  const largeText = documentWith([shape("shape"), textLayer({ id: "text", name: "Text", panel: "wrap", x: 2, y: 0, width: 1, height: 1, fontSize: 200 })]);
  assert.deepEqual(transformCoverSelection(metrics, largeText, ["shape", "text"], { scale: 2 }), []);
});

test("alignment and spacing use rotated visual edges across panel origins", () => {
  const layers = [shape("back", { panel: "back", x: 1, width: 2, rotation: 90 }), shape("front", { panel: "front", x: 2 })];
  const patches = alignCoverLayers(metrics, layers, "left");
  const moved = layers.map((layer) => ({ ...layer, ...patches.find((p) => p.id === layer.id) }));
  const { rotatedStudioBounds } = require("./.compiled/src/lib/studioGeometry.js");
  close(rotatedStudioBounds(coverSpreadRect(metrics, moved[0]), 90).x, rotatedStudioBounds(coverSpreadRect(metrics, moved[1]), 0).x);
  const rects = [shape("wide", { width: 2 }), shape("middle", { x: 3 }), shape("last", { x: 6 })];
  assert.notEqual(distributeCoverLayers(metrics, rects, "horizontal", "centers")[1].x, distributeCoverLayers(metrics, rects, "horizontal", "gaps")[1].x);
});
