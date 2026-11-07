const test = require("node:test");
const assert = require("node:assert/strict");
const { studioBounds, rotatedStudioBounds, alignStudioRects, distributeStudioRects } = require("./.compiled/src/lib/studioGeometry.js");
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

test("page and cover rectangles share alignment without changing size or the other axis", () => {
  const rects = [{ id: "image", x: 30, y: 40, width: 20, height: 15 }, { id: "text", x: 70, y: 10, width: 30, height: 25 }];
  const before = JSON.stringify(rects);
  const aligned = alignStudioRects(rects, "center-x", { x: 0, y: 0, width: 100, height: 140 });
  assert.deepEqual(aligned.map((r) => [r.x, r.y, r.width, r.height]), [[40, 40, 20, 15], [35, 10, 30, 25]]);
  assert.deepEqual(alignStudioRects(rects, "bottom").map((r) => r.y), [40, 30]);
  assert.equal(JSON.stringify(rects), before);
});

test("equal gaps and equal centers handle different sizes and preserve input order", () => {
  const rects = [{ id: "last", x: 90, y: 5, width: 10, height: 10 }, { id: "first", x: 0, y: 6, width: 20, height: 10 }, { id: "middle", x: 30, y: 7, width: 10, height: 10 }];
  const gaps = distributeStudioRects(rects, "horizontal", "gaps");
  const centers = distributeStudioRects(rects, "horizontal", "centers");
  assert.deepEqual(gaps.map((r) => [r.id, r.x, r.y]), [["last", 90, 5], ["first", 0, 6], ["middle", 50, 7]]);
  assert.equal(centers[2].x, 47.5);
  assert.equal(rects[2].x, 30);
  const vertical = distributeStudioRects(rects.map((r) => ({ ...r, y: r.x, height: r.width })), "vertical");
  assert.equal(vertical[2].y, 50);
  assert.equal(vertical[2].x, 30);
});

test("rotated visual bounds keep their center and include every corner", () => {
  const rect = { x: 10, y: 20, width: 40, height: 10 };
  const bounds = rotatedStudioBounds(rect, 90);
  close(bounds.x, 25); close(bounds.y, 5); close(bounds.width, 10); close(bounds.height, 40);
  const diagonal = rotatedStudioBounds(rect, -45);
  close(diagonal.x + diagonal.width / 2, 30);
  close(diagonal.y + diagonal.height / 2, 25);
  close(diagonal.width, 50 / Math.sqrt(2));
});

test("empty, malformed and insufficient geometry has no arrangement result", () => {
  assert.equal(studioBounds([]), null);
  assert.equal(studioBounds([{ x: 0, y: NaN, width: 20, height: 10 }]), null);
  assert.deepEqual(alignStudioRects([{ x: 0, y: 0, width: -20, height: 10 }], "left"), []);
  assert.deepEqual(distributeStudioRects([{ x: 0, y: 0, width: 20, height: 10 }], "horizontal"), []);
});

test("overlapping selections can be distributed without silently expanding their span", () => {
  const rects = [{ x: 0, y: 0, width: 50, height: 10 }, { x: 10, y: 0, width: 40, height: 10 }, { x: 30, y: 0, width: 50, height: 10 }];
  const result = distributeStudioRects(rects, "horizontal");
  assert.deepEqual(result.map((r) => r.x), [0, 20, 30]);
  assert.deepEqual(studioBounds(result), studioBounds(rects));
});
