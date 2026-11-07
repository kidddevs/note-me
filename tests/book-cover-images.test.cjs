const test = require("node:test");
const assert = require("node:assert/strict");
const { coverSelectionExportBounds, liftCoverBackground, matchCoverImageRatio, renderCoverSelectionCanvas, resetCoverImageCrop, resetCoverImageTone } = require("./.compiled/src/lib/bookCoverImages.js");
const { coverMetrics, emptyCoverDocument, imageLayer, parseCoverDocument, shapeLayer } = require("./.compiled/src/lib/bookCoverDoc.js");

const metrics = coverMetrics("6x9", { pageCount: 320, paperStock: "cream-60", bleed: 0.125, spineWidthOverride: 0 });
function photo() {
  return imageLayer({ id: "photo", name: "Photo", panel: "front", x: 1, y: 2, width: 4, height: 3, src: "data:image/png;base64,AA==", sourceWidth: 1000, sourceHeight: 2000, focusX: 0.1, focusY: 0.8, flipX: true, mask: "circle", eraseMask: "data:image/png;base64,mask", brightness: 140, contrast: 150, hue: 50, tint: "#aabbcc", tintStrength: 0.5 });
}

test("image resets keep painted erase work and isolate tone from cropping", () => {
  const layer = photo();
  const tone = resetCoverImageTone(layer);
  assert.equal(tone.brightness, 100);
  assert.equal(tone.tintStrength, 0);
  assert.equal(tone.focusX, 0.1);
  assert.equal(tone.flipX, true);
  assert.equal(tone.mask, "circle");
  assert.equal(tone.eraseMask, layer.eraseMask);
  const crop = resetCoverImageCrop(layer);
  assert.equal(crop.focusX, 0.5);
  assert.equal(crop.flipX, false);
  assert.equal(crop.mask, "none");
  assert.equal(crop.brightness, 140);
  assert.equal(crop.eraseMask, layer.eraseMask);
  assert.equal(layer.brightness, 140);
});

test("matching the source ratio keeps frame center and handles legacy sources", () => {
  const layer = photo();
  const patch = matchCoverImageRatio(layer);
  assert.equal(patch.height, 8);
  assert.equal(patch.y + patch.height / 2, layer.y + layer.height / 2);
  assert.equal(matchCoverImageRatio({ ...layer, sourceWidth: 0 }), null);
});

test("lifting a background preserves its complete supported appearance at full-wrap size", () => {
  const doc = parseCoverDocument({ backgroundImage: { src: "/photo.jpg", sourceWidth: 4320, sourceHeight: 3000, fit: "contain", focusX: 0.1, focusY: 0.7, opacity: 0.65, blur: 0.02, tint: "#abcdef80", tintStrength: 0.4 }, layers: [photo()] });
  const lifted = liftCoverBackground(doc, metrics, "lifted");
  assert.equal(lifted.doc.backgroundImage, null);
  assert.equal(lifted.doc.layers[0].id, "lifted");
  assert.equal(lifted.doc.layers[1].id, "photo");
  assert.equal(lifted.layer.panel, "wrap");
  assert.equal(lifted.layer.width, metrics.fullWidth);
  assert.equal(lifted.layer.height, metrics.fullHeight);
  for (const [key, value] of Object.entries(doc.backgroundImage)) assert.equal(lifted.layer[key], value);
  assert.ok(doc.backgroundImage);
  assert.equal(liftCoverBackground(emptyCoverDocument(), metrics, "empty"), null);
});

test("selection bounds include rotation and effects in full-wrap coordinates", () => {
  const layer = shapeLayer({ id: "shape", name: "Shape", panel: "wrap", x: 1, y: 2, width: 2, height: 1, rotation: 90, shape: "rectangle" });
  const bounds = coverSelectionExportBounds(metrics, [layer]);
  assert.ok(Math.abs(bounds.width - 1.05) < 0.00001);
  assert.ok(Math.abs(bounds.height - 2.05) < 0.00001);
  assert.equal(bounds.x, 1.475);
  const effect = coverSelectionExportBounds(metrics, [{ ...layer, glow: { ...layer.glow, enabled: true, blur: 0.1 } }]);
  assert.ok(effect.width > bounds.width);
  const front = coverSelectionExportBounds(metrics, [photo()]);
  assert.ok(front.x > metrics.panelOrigins.front.x);
  assert.equal(coverSelectionExportBounds(metrics, []), null);
});

test("selection export rejects empty and oversized work before allocating a canvas", async () => {
  const cover = { pageCount: 320, paperStock: "cream-60", bleed: 0.125, spineWidthOverride: 0, doc: emptyCoverDocument() };
  await assert.rejects(renderCoverSelectionCanvas({ trim_size: "6x9" }, cover, []), /visible layer/);
  const huge = { ...photo(), width: 100, height: 100 };
  cover.doc.layers = [huge];
  await assert.rejects(renderCoverSelectionCanvas({ trim_size: "6x9" }, cover, [huge.id]), /too large/);
});

test("cover image source details survive normalization and background lifting", () => {
  const source = { alt: 'Tide & "light"', credit: "Amelia Hart", license: "Archive permission" };
  const layer = imageLayer({ ...photo(), ...source });
  const doc = { ...emptyCoverDocument(), backgroundImage: { src: layer.src, sourceWidth: 1000, sourceHeight: 2000, fit: "cover", focusX: 0.2, focusY: 0.8, opacity: 1, blur: 0, tint: "#ffffff", tintStrength: 0, ...source }, layers: [layer] };
  const parsed = parseCoverDocument(doc);
  for (const key of ["alt", "credit", "license"]) {
    assert.equal(parsed.layers[0][key], source[key]);
    assert.equal(parsed.backgroundImage[key], source[key]);
    assert.equal(liftCoverBackground(parsed, metrics, "lifted").layer[key], source[key]);
  }
});
