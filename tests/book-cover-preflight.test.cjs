const test = require("node:test");
const assert = require("node:assert/strict");
const { coverPreflight, coverPreflightSummary } = require("./.compiled/src/lib/bookCoverPreflight.js");
const { barcodeLayer, parseCoverDocument, textLayer } = require("./.compiled/src/lib/bookCoverDoc.js");

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
