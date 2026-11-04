const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_CLIPBOARD_LAYERS,
  clearCoverLayerClipboard,
  getCoverLayerClipboard,
  hasCoverLayerClipboard,
  setCoverLayerClipboard,
} = require("./.compiled/src/lib/bookCoverClipboard");
const { textLayer } = require("./.compiled/src/lib/bookCoverDoc");

function layer(id, text) {
  return textLayer({ id, name: id, panel: "front", x: 1, y: 1, width: 2, height: 1, text });
}

test("cross-book clipboard deep-clones layers and can be cleared", () => {
  clearCoverLayerClipboard();
  assert.equal(hasCoverLayerClipboard(), false);
  const source = [layer("a", "Title"), layer("b", "Author")];
  setCoverLayerClipboard(source);
  assert.equal(hasCoverLayerClipboard(), true);
  source[0].text = "Mutated";
  source.push(layer("c", "Later"));
  const copied = getCoverLayerClipboard();
  assert.equal(copied.length, 2);
  assert.equal(copied[0].text, "Title");
  copied[0].text = "Changed again";
  assert.equal(getCoverLayerClipboard()[0].text, "Title");
  clearCoverLayerClipboard();
  assert.equal(hasCoverLayerClipboard(), false);
  assert.deepEqual(getCoverLayerClipboard(), []);
});

test("cross-book clipboard caps very large selections", () => {
  clearCoverLayerClipboard();
  setCoverLayerClipboard(Array.from({ length: MAX_CLIPBOARD_LAYERS + 10 }, (_, index) => layer(`layer-${index}`, String(index))));
  assert.equal(getCoverLayerClipboard().length, MAX_CLIPBOARD_LAYERS);
  clearCoverLayerClipboard();
});
