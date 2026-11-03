const test = require("node:test");
const assert = require("node:assert/strict");
const {
  alignCoverLayers,
  coverGuidePanelPosition,
  coverGuideSpreadPosition,
  distributeCoverLayers,
  snapCoverRect,
} = require("./.compiled/src/lib/bookCoverGeometry.js");
const {
  parseCoverDocument,
  reflowSpineLayers,
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
