const test = require("node:test");
const assert = require("node:assert/strict");
const { unzipSync } = require("fflate");
const { buildCoverPackageZip, coverPreflightText, coverSpecsText } = require("./.compiled/src/lib/bookCoverPackage.js");

const book = { title: "The Quiet Hour", author: "Amelia Hart", trim_size: "6x9" };
const cover = {
  pageCount: 320,
  paperStock: "cream-60",
  spineWidthOverride: 0,
  bleed: 0.125,
  isbn: "978-0-306-40615-7",
  publisher: "Quiet Press",
};

test("spec sheet captures print, colour, and handoff details", () => {
  const text = coverSpecsText(book, cover, { pdfx: true });
  assert.match(text, /The Quiet Hour/);
  assert.match(text, /Amelia Hart/);
  assert.match(text, /Spine width\s+0\.8 in/);
  assert.match(text, /Cream 60#/);
  assert.match(text, /PDF\/X-4/);
  assert.match(text, /978-0-306-40615-7/);
  assert.match(text, /Cover Studio/);
  assert.match(text, /PREFLIGHT/);
  assert.match(text, /errors · \d+ warnings/);
  assert.match(text, /preflight\.txt/);
});

test("preflight report lists findings by severity with counts", () => {
  const text = coverPreflightText(book, { ...cover, doc: { layers: [], groups: [], guides: [], palette: [], background: { type: "solid", color: "#ffffff", gradient: { type: "linear", angle: 0, stops: [] } } } });
  assert.match(text, /The Quiet Hour/);
  assert.match(text, /Amelia Hart/);
  assert.match(text, /Errors: \d+/);
  assert.match(text, /\[ERROR\] ISBN barcode/);
  assert.match(text, /\[WARNING\] Front title/);
  assert.match(text, /\[WARNING\] Cover inclusion/);
});

test("production ZIP contains named cover assets", () => {
  const zip = buildCoverPackageZip([
    { name: "front.png", bytes: new Uint8Array([1, 2, 3]) },
    { name: "specs.txt", bytes: new TextEncoder().encode("hello") },
  ]);
  const entries = unzipSync(zip);
  assert.ok(entries["cover/front.png"]);
  assert.deepEqual(Array.from(entries["cover/front.png"]), [1, 2, 3]);
  assert.equal(new TextDecoder().decode(entries["cover/specs.txt"]), "hello");
});
