const test = require("node:test");
const assert = require("node:assert/strict");
const { coverPreflight, coverPreflightFix, coverPreflightSummary } = require("./.compiled/src/lib/bookCoverPreflight.js");
const { barcodeLayer, imageLayer, parseCoverDocument, textLayer } = require("./.compiled/src/lib/bookCoverDoc.js");

const book = { title: "The Quiet Hour", author: "Amelia Hart", trim_size: "6x9" };
const baseCover = {
  pageCount: 320,
  paperStock: "cream-60",
  spineWidthOverride: 0,
  bleed: 0.125,
  isbn: "978-0-306-40615-7",
  publisher: "Quiet Press",
  enabled: true,
};

function coverWith(layers) {
  return { ...baseCover, doc: parseCoverDocument({ layers }) };
}

const completeLayers = [
  textLayer({ id: "title", name: "Title", panel: "front", x: 0.5, y: 0.5, width: 4, height: 1.5, text: "{{title}}" }),
  textLayer({ id: "author", name: "Author", panel: "front", x: 0.5, y: 7, width: 3, height: 0.5, text: "{{author}}" }),
  barcodeLayer({ id: "barcode", name: "ISBN barcode", panel: "back", x: 3.4, y: 7.4, width: 2, height: 1.1 }),
  textLayer({ id: "spine", name: "Spine title", panel: "spine", x: 0.3, y: 2, width: 0.1, height: 4, text: "{{title}}", fontSize: 8 }),
];

test("a complete wrap passes preflight without blocking issues", () => {
  const checks = coverPreflight(book, coverWith(completeLayers));
  const summary = coverPreflightSummary(checks);
  assert.equal(summary.errors, 0);
  assert.ok(summary.passes >= 6);
  assert.ok(checks.some((check) => check.id === "barcode-placement" && check.severity === "pass"));
  assert.ok(checks.some((check) => check.id === "spine-type" && check.severity === "pass"));
});

test("preflight catches missing barcode, invalid ISBN, and low bleed", () => {
  const noBarcode = coverPreflight(book, coverWith(completeLayers.filter((layer) => layer.id !== "barcode")));
  assert.ok(noBarcode.some((check) => check.id === "barcode" && check.severity === "error"));

  const badIsbn = coverPreflight(book, { ...coverWith(completeLayers), isbn: "123" });
  assert.ok(badIsbn.some((check) => check.id === "isbn" && check.severity === "error"));

  const correctedDigits = coverPreflight(book, { ...coverWith(completeLayers), isbn: "978-0-306-40615-0" });
  assert.ok(correctedDigits.some((check) => check.id === "isbn-check" && check.severity === "warning"));

  const lowBleed = coverPreflight(book, { ...coverWith(completeLayers), bleed: 0.05 });
  assert.ok(lowBleed.some((check) => check.id === "bleed" && check.severity === "warning"));
});

test("preflight catches overflow, small barcodes, and tiny spine text", () => {
  const outside = textLayer({ id: "outside", name: "Outside", panel: "front", x: 5.8, y: 1, width: 1, height: 1, text: "Trimmed" });
  const overflow = coverPreflight(book, coverWith([...completeLayers, outside]));
  assert.ok(overflow.some((check) => check.id === "safe-zone" && check.severity === "error" && check.layerId === "outside"));

  const smallBarcode = barcodeLayer({ id: "barcode", name: "ISBN barcode", panel: "back", x: 3.4, y: 7.4, width: 1.4, height: 0.7 });
  const barcodeChecks = coverPreflight(book, coverWith([...completeLayers.filter((layer) => layer.id !== "barcode"), smallBarcode]));
  assert.ok(barcodeChecks.some((check) => check.id === "barcode-size" && check.severity === "warning"));

  const tinySpine = coverPreflight(book, coverWith([...completeLayers.filter((layer) => layer.id !== "spine"), textLayer({ id: "spine", name: "Spine title", panel: "spine", x: 0.3, y: 2, width: 0.1, height: 4, text: "{{title}}", fontSize: 5 })]));
  assert.ok(tinySpine.some((check) => check.id === "spine-type" && check.severity === "warning"));
});


test("preflight fixes add a safe barcode and preserve the rest of the design", () => {
  const cover = coverWith(completeLayers.filter((layer) => layer.id !== "barcode"));
  const check = coverPreflight(book, cover).find((item) => item.id === "barcode");
  assert.ok(check.fix);
  const result = coverPreflightFix(book, cover, check);
  assert.ok(result);
  const next = { ...cover, ...result.patch };
  const barcode = next.doc.layers.find((layer) => layer.type === "barcode");
  assert.ok(barcode);
  assert.equal(barcode.panel, "back");
  assert.equal(barcode.width, 2);
  assert.equal(barcode.height, 1.2);
  assert.equal(barcode.x, 3.75);
  assert.equal(barcode.y, 7.55);
  const checks = coverPreflight(book, next);
  assert.equal(checks.find((item) => item.id === "barcode-placement").severity, "pass");
  assert.equal(checks.find((item) => item.id === "barcode-size").severity, "pass");
  assert.equal(checks.find((item) => item.id === "safe-zone").severity, "pass");
});

test("preflight fixes enlarge barcodes and move them to the back cover", () => {
  const small = barcodeLayer({ id: "small", name: "Small barcode", panel: "front", x: 0.4, y: 0.4, width: 1.2, height: 0.6 });
  const cover = coverWith([...completeLayers.filter((layer) => layer.id !== "barcode"), small]);
  const checks = coverPreflight(book, cover);
  const sizeCheck = checks.find((item) => item.id === "barcode-size");
  assert.ok(sizeCheck.fix);
  const sized = coverPreflightFix(book, cover, sizeCheck);
  const sizedCover = { ...cover, ...sized.patch };
  const fixed = sizedCover.doc.layers.find((layer) => layer.id === "small");
  assert.equal(fixed.panel, "back");
  assert.ok(fixed.width >= 1.7);
  assert.ok(fixed.height >= 0.95);
  assert.ok(fixed.x + fixed.width <= 6);
  assert.ok(fixed.y + fixed.height <= 9);
});

test("preflight fixes hide duplicate barcodes and raise tiny spine type", () => {
  const second = barcodeLayer({ id: "barcode-2", name: "Spare barcode", panel: "back", x: 3.2, y: 6, width: 2, height: 1.1 });
  const cover = coverWith([...completeLayers, second]);
  const dedupe = coverPreflightFix(book, cover, coverPreflight(book, cover).find((item) => item.id === "barcode-duplicate"));
  assert.ok(dedupe);
  const deduped = { ...cover, ...dedupe.patch };
  assert.equal(deduped.doc.layers.find((layer) => layer.id === "barcode-2").visible, false);
  assert.equal(deduped.doc.layers.find((layer) => layer.id === "barcode").visible, true);

  const tiny = textLayer({ id: "spine-tiny", name: "Spine tiny", panel: "spine", x: 0.3, y: 2, width: 0.1, height: 4, text: "Tiny", fontSize: 5 });
  const spineCover = coverWith([...completeLayers.filter((layer) => layer.id !== "spine"), tiny]);
  const spineFix = coverPreflightFix(book, spineCover, coverPreflight(book, spineCover).find((item) => item.id === "spine-type"));
  assert.ok(spineFix);
  const spineNext = { ...spineCover, ...spineFix.patch };
  assert.equal(spineNext.doc.layers.find((layer) => layer.id === "spine-tiny").fontSize, 6.5);
});

test("preflight fixes clamp layers inside the trim-safe zone", () => {
  const outside = textLayer({ id: "outside", name: "Outside", panel: "front", x: 5.8, y: 1, width: 1, height: 1, text: "Trimmed" });
  const cover = coverWith([...completeLayers, outside]);
  const check = coverPreflight(book, cover).find((item) => item.id === "safe-zone");
  const result = coverPreflightFix(book, cover, check);
  assert.ok(result);
  const next = { ...cover, ...result.patch };
  const layer = next.doc.layers.find((item) => item.id === "outside");
  assert.equal(layer.x, 4.75);
  assert.equal(layer.y, 1);
  assert.equal(coverPreflight(book, next).find((item) => item.id === "safe-zone").severity, "pass");
});

test("preflight fixes enable the cover and correct the ISBN check digit", () => {
  const cover = { ...coverWith(completeLayers), enabled: false, isbn: "978-0-306-40615-0" };
  const checks = coverPreflight(book, cover);
  const enabled = coverPreflightFix(book, cover, checks.find((item) => item.id === "enabled"));
  assert.equal(enabled.patch.enabled, true);
  const isbn = coverPreflightFix(book, cover, checks.find((item) => item.id === "isbn-check"));
  assert.ok(isbn);
  const next = { ...cover, ...isbn.patch };
  assert.ok(next.isbn.endsWith("7"));
  assert.equal(coverPreflight(book, next).find((item) => item.id === "isbn").severity, "pass");
});


test("preflight reports image resolution and can fit low-resolution layers to 300 DPI", () => {
  const lowRes = imageLayer({ id: "low-res", name: "Low res", panel: "front", x: 1, y: 1, width: 4, height: 6, src: "data:image/jpeg;base64,AA==", sourceWidth: 500, sourceHeight: 750 });
  const cover = coverWith([...completeLayers, lowRes]);
  const check = coverPreflight(book, cover).find((item) => item.id === "image-resolution");
  assert.equal(check.severity, "warning");
  assert.match(check.detail, /below 150 DPI/);
  assert.match(check.detail, /125 DPI/);
  assert.ok(check.fix);

  const result = coverPreflightFix(book, cover, check);
  assert.ok(result);
  const next = { ...cover, ...result.patch };
  const fixed = next.doc.layers.find((layer) => layer.id === "low-res");
  assert.equal(fixed.width, 1.667);
  assert.equal(fixed.height, 2.5);
  assert.equal(fixed.x, 2.167);
  assert.equal(fixed.y, 2.75);
  assert.equal(coverPreflight(book, next).find((item) => item.id === "image-resolution").severity, "pass");

  const highRes = imageLayer({ id: "high-res", name: "High res", panel: "front", x: 1, y: 1, width: 4, height: 6, src: "data:image/jpeg;base64,AA==", sourceWidth: 3000, sourceHeight: 4500 });
  assert.equal(coverPreflight(book, coverWith([...completeLayers, highRes])).find((item) => item.id === "image-resolution").severity, "pass");

  const legacy = imageLayer({ id: "legacy", name: "Legacy", panel: "front", x: 1, y: 1, width: 4, height: 6, src: "data:image/jpeg;base64,AA==" });
  const legacyCheck = coverPreflight(book, coverWith([...completeLayers, legacy])).find((item) => item.id === "image-resolution");
  assert.equal(legacyCheck.severity, "info");
  assert.equal(legacyCheck.fix, undefined);
});


test("background resolution uses full-wrap geometry and the actual fit", () => {
  const cover = coverWith(completeLayers);
  const backgroundImage = { src: "/photo.jpg", sourceWidth: 1305, sourceHeight: 925 };
  cover.doc = parseCoverDocument({ ...cover.doc, backgroundImage });
  const check = () => coverPreflight(book, cover).find((item) => item.id === "background-resolution");
  assert.equal(check().severity, "warning");
  assert.match(check().detail, /100 DPI/);
  assert.equal(check().fix, undefined);
  cover.doc.backgroundImage.sourceWidth = 5220;
  cover.doc.backgroundImage.sourceHeight = 3700;
  assert.equal(check().severity, "pass");
  cover.doc.backgroundImage.sourceWidth = 1305;
  cover.doc.backgroundImage.fit = "contain";
  assert.equal(check().severity, "pass");
  cover.doc.backgroundImage.sourceWidth = 0;
  assert.equal(check().severity, "info");
  cover.doc.backgroundImage.opacity = 0;
  assert.equal(check(), undefined);
});
