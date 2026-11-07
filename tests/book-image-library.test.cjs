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

const {
  normalizeCoverImageDetails, normalizeCoverImageAsset, prepareCoverImageAsset,
  filterCoverImageAssets, updateCoverImageAsset,
} = require("./.compiled/src/lib/bookImageLibrary");

const source = (overrides = {}) => ({ name: "Shoreline", src: "data:image/png;base64,c2hvcmU=", width: 2400, height: 1600, ...overrides });
const instant = new Date("2026-11-07T09:00:00Z");
const asset = (overrides = {}) => prepareCoverImageAsset(source(overrides), [], instant, overrides.id ?? "photo-1");

test("legacy library records get safe metadata defaults without losing their source", () => {
  const legacy = { id: "older", src: "data:image/png;base64,AA==", name: "An older photo", width: 10, height: 20, createdAt: instant.toISOString() };
  const normalized = normalizeCoverImageAsset(legacy);
  assert.equal(normalized.src, legacy.src);
  assert.equal(normalized.updatedAt, legacy.createdAt);
  assert.equal(normalized.alt, "");
  assert.equal(normalized.credit, "");
  assert.deepEqual(normalized.tags, []);
  assert.equal(normalized.favorite, false);
  assert.equal(legacy.updatedAt, undefined);
  assert.equal(normalizeCoverImageAsset({ src: "missing an id" }), null);
  assert.equal(normalizeCoverImageAsset(null), null);
});

test("image details normalize pasted lines, bound lengths, and deduplicate tags", () => {
  const normalized = normalizeCoverImageDetails({ alt: "  A\nshore\tline  ", credit: "x".repeat(300), tags: ["Sea", "sea", "  Travel  ", "", 2], favorite: true });
  assert.equal(normalized.alt, "A shore line");
  assert.equal(normalized.credit.length, 240);
  assert.deepEqual(normalized.tags, ["sea", "Travel"]);
  assert.equal(normalized.favorite, true);
  assert.equal(normalizeCoverImageAsset({ id: "odd", src: "data:image/png,a", width: Infinity, height: -8 }).width, 0);
});

test("saving the same source reuses its id and editorial details", () => {
  const original = asset({ alt: "Sunrise over the shore", credit: "Amelia Hart", license: "Personal collection", tags: ["travel"], favorite: true });
  const updated = prepareCoverImageAsset(source({ name: "renamed-file.png", width: 0, height: 0 }), [original], new Date("2026-11-08T00:00:00Z"), "must-not-be-used");
  assert.equal(updated.id, original.id);
  assert.equal(updated.name, "Shoreline");
  assert.equal(updated.width, 2400);
  assert.equal(updated.credit, original.credit);
  assert.deepEqual(updated.tags, original.tags);
  assert.equal(updated.favorite, true);
  assert.equal(updated.createdAt, original.createdAt);
  assert.notEqual(updated.updatedAt, original.updatedAt);
  const explicit = prepareCoverImageAsset(source({ credit: "", alt: "New alt" }), [original], instant, "ignored");
  assert.equal(explicit.credit, "");
  assert.equal(explicit.alt, "New alt");
  const unspecified = prepareCoverImageAsset(source({ credit: undefined }), [original], instant, "ignored");
  assert.equal(unspecified.credit, original.credit);
  assert.equal(original.alt, "Sunrise over the shore");
});

test("a full library rejects new sources and preserves every existing image", () => {
  const full = Array.from({ length: MAX_COVER_IMAGE_ASSETS }, (_, index) => asset({ id: `image-${index}`, src: `data:image/png,${index}` }));
  const before = JSON.stringify(full);
  assert.equal(prepareCoverImageAsset(source(), full, instant, "new"), null);
  assert.equal(prepareCoverImageAsset(source({ src: full[7].src }), full, instant, "unused").id, full[7].id);
  assert.equal(JSON.stringify(full), before);
});

test("image search combines metadata terms, orientation and favorite filters", () => {
  const photos = [asset({ id: "land", credit: "Amelia Hart", tags: ["Travel", "coast"], favorite: true }), asset({ id: "portrait", src: "portrait", width: 1200, height: 2400, alt: "Coast portrait" }), asset({ id: "square", src: "square", width: 1000, height: 1000, license: "Archive permission" }), asset({ id: "legacy", src: "legacy", width: 0, height: 0 })];
  assert.deepEqual(filterCoverImageAssets(photos, "TRAVEL amelia", "landscape", true).map((item) => item.id), ["land"]);
  assert.deepEqual(filterCoverImageAssets(photos, "coast", "portrait").map((item) => item.id), ["portrait"]);
  assert.deepEqual(filterCoverImageAssets(photos, "permission", "square").map((item) => item.id), ["square"]);
  assert.equal(filterCoverImageAssets(photos, "", "all").length, 4);
  assert.equal(filterCoverImageAssets(photos, "", "landscape").length, 1);
  assert.equal(filterCoverImageAssets(photos, "does not exist").length, 0);
});

test("image metadata updates fail honestly without browser storage", async () => {
  assert.equal(await updateCoverImageAsset("missing", { credit: "Photo credit" }), null);
});
