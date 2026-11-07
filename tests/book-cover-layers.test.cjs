const test = require("node:test");
const assert = require("node:assert/strict");
const { moveCoverLayers, stepCoverLayers } = require("./.compiled/src/lib/bookCoverLayers.js");
const { emptyCoverDocument, textLayer } = require("./.compiled/src/lib/bookCoverDoc.js");

function document() {
  return { ...emptyCoverDocument(), layers: ["a", "b", "c", "d"].map((id) => textLayer({ id, name: id, panel: "front", x: 0, y: 0, width: 1, height: 1, text: id })) };
}
const order = (doc) => doc.layers.map((layer) => layer.id);

test("drop before and after follow the reversed visible list in both directions", () => {
  const doc = document();
  assert.deepEqual(order(moveCoverLayers(doc, ["a"], { layerId: "c", placement: "before" })), ["b", "c", "a", "d"]);
  assert.deepEqual(order(moveCoverLayers(doc, ["d"], { layerId: "b", placement: "after" })), ["a", "d", "b", "c"]);
  assert.deepEqual(order(doc), ["a", "b", "c", "d"]);
  assert.equal(moveCoverLayers(doc, ["a"], { layerId: "a" }), null);
  assert.equal(moveCoverLayers(doc, ["c"], { layerId: "b", placement: "before" }), null);
  assert.equal(moveCoverLayers(doc, ["a"], { layerId: "missing" }), null);
});

test("multi-selection moves as one ordered block, including with arrow controls", () => {
  const doc = document();
  assert.deepEqual(order(moveCoverLayers(doc, ["b", "a"], { layerId: "d", placement: "before" })), ["c", "d", "a", "b"]);
  assert.deepEqual(order(stepCoverLayers(doc, ["a", "b"], "up")), ["c", "a", "b", "d"]);
  assert.deepEqual(order(stepCoverLayers(doc, ["c", "d"], "down")), ["a", "c", "d", "b"]);
  assert.equal(stepCoverLayers(doc, ["d"], "up"), null);
});

test("group drops gather selected layers, reveal the destination, and allow leaving a group", () => {
  const doc = document();
  doc.groups = [{ id: "g", name: "Group", visible: true, locked: false, collapsed: true }];
  doc.layers[2].groupId = "g";
  const moved = moveCoverLayers(doc, ["a", "b"], { groupId: "g" });
  assert.deepEqual(order(moved), ["c", "a", "b", "d"]);
  assert.equal(moved.groups[0].collapsed, false);
  assert.ok(moved.layers.slice(0, 3).every((layer) => layer.groupId === "g"));
  const released = moveCoverLayers(moved, ["a", "b"], { groupId: null });
  assert.deepEqual(order(released), ["a", "b", "c", "d"]);
  assert.equal(released.layers[0].groupId, null);
  assert.equal(doc.groups[0].collapsed, true);
});

test("layer and inherited group locks prevent partial selection moves", () => {
  const doc = document();
  doc.layers[0].locked = true;
  assert.equal(moveCoverLayers(doc, ["a", "b"], { layerId: "d" }), null);
  doc.layers[0].locked = false;
  doc.groups = [{ id: "g", name: "Group", visible: true, locked: true, collapsed: false }];
  doc.layers[0].groupId = "g";
  assert.equal(moveCoverLayers(doc, ["a", "b"], { layerId: "d" }), null);
  assert.equal(moveCoverLayers(doc, ["b"], { groupId: "g" }), null);
  assert.equal(moveCoverLayers(doc, ["b"], { groupId: "missing" }), null);
});
