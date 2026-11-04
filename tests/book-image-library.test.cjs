const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_COVER_IMAGE_ASSETS,
  estimateImageBytes,
  deleteCoverImageAsset,
  listCoverImageAssets,
  saveCoverImageAsset,
} = require("./.compiled/src/lib/bookImageLibrary");

test("image library degrades gracefully when IndexedDB is unavailable", async () => {
  assert.deepEqual(await listCoverImageAssets(), []);
  assert.equal(await saveCoverImageAsset({ name: "Photo", src: "data:image/png;base64,AA==", width: 100, height: 150 }), null);
  assert.equal(await deleteCoverImageAsset("missing"), false);
  assert.equal(MAX_COVER_IMAGE_ASSETS, 24);
});

test("image asset byte estimates stay in the right ballpark", () => {
  assert.equal(estimateImageBytes(""), 0);
  assert.equal(estimateImageBytes("abcd"), 3);
  assert.equal(estimateImageBytes("abcdefgh"), 6);
});
